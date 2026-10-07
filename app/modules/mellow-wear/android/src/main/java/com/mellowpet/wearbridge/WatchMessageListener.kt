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
    if (event.path != PATH_CHECKIN) return
    val raw = String(event.data)
    val payload = try {
      JSONObject(raw)
    } catch (_: Exception) {
      return
    }
    WatchInbox.add(this, payload)
  }

  companion object {
    const val PATH_CHECKIN = "/mellow/checkin"
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
