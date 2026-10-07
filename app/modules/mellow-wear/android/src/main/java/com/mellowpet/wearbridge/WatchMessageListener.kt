package com.mellowpet.wearbridge

import android.content.Context
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Recebe check-ins do relogio.
 *
 * Quem grava no Supabase e o JS do app, que tem a sessao; este servico roda
 * sem ela e muitas vezes com o app fechado. Entao ele so enfileira, e o app
 * drena a fila quando abre — mesmo desenho do PendingActions dos widgets.
 *
 * Consequencia honesta: um check-in feito no relogio aparece no historico
 * quando o app do celular for aberto, nao no instante do toque.
 */
class WatchMessageListener : WearableListenerService() {

  override fun onMessageReceived(event: MessageEvent) {
    when (event.path) {
      PATH_CHECKIN -> {
        val payload = try {
          JSONObject(String(event.data))
        } catch (_: Exception) {
          return
        }
        WatchInbox.add(this, payload)
      }

      // Comando de midia nao entra na fila: pausar dez minutos depois, quando
      // o app finalmente abrisse, seria pior que nao pausar. Fica so o ultimo,
      // com hora, e o JS descarta o que ja envelheceu.
      PATH_MEDIA -> MediaCommand.set(this, String(event.data))

      PATH_OPEN -> {
        packageManager.getLaunchIntentForPackage(packageName)?.let {
          it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
          startActivity(it)
        }
      }
    }
  }

  companion object {
    const val PATH_CHECKIN = "/mellow/checkin"
    const val PATH_MEDIA = "/mellow/media"
    const val PATH_OPEN = "/mellow/open"
  }
}

/** Fila de check-ins recebidos do relogio, aguardando o app drenar. */
internal object WatchInbox {
  private const val PREFS = "mellow_wear_bridge"
  private const val KEY = "inbox"
  private const val MAX = 200

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

  /** Devolve tudo e esvazia — o app assume a partir daqui. */
  fun drain(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val json = prefs.getString(KEY, null) ?: "[]"
    prefs.edit().remove(KEY).apply()
    return json
  }

  private fun read(raw: String?): JSONArray = try {
    if (raw.isNullOrEmpty()) JSONArray() else JSONArray(raw)
  } catch (_: Exception) {
    JSONArray()
  }
}

/** Ultimo comando de midia vindo do relogio. */
internal object MediaCommand {
  private const val PREFS = "mellow_wear_bridge"

  fun set(context: Context, command: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("media_cmd", command)
      .putLong("media_at", System.currentTimeMillis())
      .apply()
  }

  /** Devolve "comando:idadeEmMs" e limpa. Vazio quando nao ha nada. */
  fun take(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val cmd = prefs.getString("media_cmd", null) ?: return ""
    val age = System.currentTimeMillis() - prefs.getLong("media_at", 0L)
    prefs.edit().remove("media_cmd").remove("media_at").apply()
    return "$cmd:$age"
  }
}
