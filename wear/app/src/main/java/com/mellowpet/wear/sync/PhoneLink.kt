package com.mellowpet.wear.sync

import android.content.Context
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject

/**
 * A ponte com o celular.
 *
 * O relogio nao tem sessao do Supabase e nao deve ter: a credencial e do app
 * do celular. Entao o fluxo e:
 *
 *   celular --(DataClient /mellow/state)-->   relogio   estado para exibir
 *   relogio --(MessageClient /mellow/checkin)--> celular   check-in para gravar
 *   relogio --(MessageClient /mellow/media)-->   celular   play, pausa, pular
 *   relogio --(MessageClient /mellow/open)-->    celular   abrir o app la
 *
 * Mensagem e "dispare e esqueca" e so chega se o celular estiver alcancavel.
 * Por isso todo check-in entra primeiro numa fila local e so sai dela quando o
 * celular confirma o recebimento — sem isso, um check-in feito fora de alcance
 * (a situacao normal de quem sai para caminhar) sumiria em silencio.
 *
 * Comandos de midia NAO entram na fila, de proposito: pausar uma musica dez
 * minutos depois, quando o aparelho voltar ao alcance, seria pior que nao
 * pausar.
 */
object PhoneLink {

  const val PATH_STATE = "/mellow/state"
  const val PATH_NOW_PLAYING = "/mellow/nowplaying"
  const val PATH_CHECKIN = "/mellow/checkin"
  const val PATH_MEDIA = "/mellow/media"
  const val PATH_OPEN = "/mellow/open"

  const val MEDIA_TOGGLE = "toggle"
  const val MEDIA_NEXT = "next"
  const val MEDIA_PREV = "prev"

  /** Algum celular pareado esta alcancavel agora? */
  suspend fun hasConnectedNode(context: Context): Boolean = try {
    Wearable.getNodeClient(context).connectedNodes.await().isNotEmpty()
  } catch (_: Exception) {
    false
  }

  private suspend fun send(context: Context, path: String, bytes: ByteArray): Boolean {
    val nodes = try {
      Wearable.getNodeClient(context).connectedNodes.await()
    } catch (_: Exception) {
      return false
    }
    if (nodes.isEmpty()) return false
    val client = Wearable.getMessageClient(context)
    var delivered = false
    for (node in nodes) {
      try {
        client.sendMessage(node.id, path, bytes).await()
        delivered = true
      } catch (_: Exception) {
        // Outro no pode estar acessivel; so falha de vez se nenhum aceitar.
      }
    }
    return delivered
  }

  suspend fun sendCheckin(context: Context, payload: JSONObject): Boolean =
    send(context, PATH_CHECKIN, payload.toString().toByteArray())

  suspend fun sendMedia(context: Context, command: String): Boolean =
    send(context, PATH_MEDIA, command.toByteArray())

  suspend fun sendOpenApp(context: Context): Boolean =
    send(context, PATH_OPEN, ByteArray(0))

  /** Le o ultimo estado que o celular empurrou. Null = nunca chegou nada. */
  suspend fun readState(context: Context): PhoneState? {
    val client: DataClient = Wearable.getDataClient(context)
    return try {
      val items = client.dataItems.await()
      val item = items.firstOrNull { it.uri.path == PATH_STATE } ?: return null
      val map = DataMapItem.fromDataItem(item).dataMap
      val music = items.firstOrNull { it.uri.path == PATH_NOW_PLAYING }
        ?.let { DataMapItem.fromDataItem(it).dataMap }
      PhoneState(
        emotion = map.getString("emotion") ?: "neutral",
        level = map.getInt("level", 1),
        streak = map.getInt("streak", 0),
        checkedInToday = map.getBoolean("checkedInToday", false),
        trackName = music?.getString("trackName")?.takeIf { it.isNotBlank() },
        playlistName = music?.getString("playlistName")?.takeIf { it.isNotBlank() },
        musicPlaying = music?.getBoolean("musicPlaying", false) ?: false,
        hoursSinceReading = map.getInt("hoursSinceReading", -1).takeIf { it >= 0 },
        alertTitle = map.getString("alertTitle"),
        alertDetail = map.getString("alertDetail"),
        caregiverName = map.getString("caregiverName")?.takeIf { it.isNotBlank() },
        caregiverPhone = map.getString("caregiverPhone")?.takeIf { it.isNotBlank() },
        updatedAt = map.getLong("updatedAt", 0L),
      ).also { items.release() }
    } catch (_: Exception) {
      null
    }
  }
}

data class PhoneState(
  val emotion: String,
  val level: Int,
  val streak: Int,
  val checkedInToday: Boolean,
  val trackName: String?,
  val playlistName: String?,
  val musicPlaying: Boolean,
  /** Horas desde a ultima leitura; null quando o celular nao informou. */
  val hoursSinceReading: Int?,
  val alertTitle: String?,
  val alertDetail: String?,
  val caregiverName: String?,
  val caregiverPhone: String?,
  val updatedAt: Long,
)

/**
 * Fila local de check-ins ainda nao entregues.
 *
 * Mesma ideia do PendingActions dos widgets no celular: quem registra nao e
 * quem grava, entao o registro espera em disco ate conseguir chegar. Limite de
 * 100 para nao crescer sem fim se o relogio ficar semanas longe do celular.
 */
object CheckinQueue {
  private const val PREFS = "mellow_wear"
  private const val KEY = "pending_checkins"
  private const val MAX = 100

  fun add(context: Context, payload: JSONObject) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val arr = read(prefs.getString(KEY, null))
    arr.put(payload)
    val trimmed = if (arr.length() > MAX) {
      JSONArray().also { out -> for (i in (arr.length() - MAX) until arr.length()) out.put(arr.get(i)) }
    } else {
      arr
    }
    prefs.edit().putString(KEY, trimmed.toString()).apply()
  }

  fun all(context: Context): List<JSONObject> {
    val arr = read(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null))
    return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }
  }

  fun clear(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
  }

  fun size(context: Context): Int = all(context).size

  /** Tenta entregar tudo que esta parado. So limpa o que o celular aceitou. */
  suspend fun flush(context: Context): Int {
    val pending = all(context)
    if (pending.isEmpty()) return 0
    var sent = 0
    for (item in pending) {
      if (PhoneLink.sendCheckin(context, item)) sent++ else break
    }
    if (sent == pending.size) {
      clear(context)
    } else if (sent > 0) {
      val rest = pending.drop(sent)
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      prefs.edit().putString(KEY, JSONArray().also { a -> rest.forEach(a::put) }.toString()).apply()
    }
    return sent
  }

  private fun read(raw: String?): JSONArray = try {
    if (raw.isNullOrEmpty()) JSONArray() else JSONArray(raw)
  } catch (_: Exception) {
    JSONArray()
  }
}
