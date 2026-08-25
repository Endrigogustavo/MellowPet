package com.mellowpet.widget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fila de ações feitas pelo widget enquanto o app estava fechado.
 *
 * O widget grava local para responder na hora, mas quem escreve no Supabase
 * é o app — o processo do launcher não tem a sessão autenticada. Então cada
 * toque vira um item aqui, e o app drena a fila assim que abre.
 *
 * Guarda no máximo 200 itens: é uma fila de conveniência, não um log — se
 * alguém passar semanas sem abrir o app, perder os toques mais antigos é
 * melhor do que crescer sem limite no SharedPreferences.
 */
internal object PendingActions {
  private const val PREFS = "mellow_widget_prefs"
  private const val KEY = "pending_actions"
  private const val MAX = 200

  fun add(context: Context, kind: String, value: String) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val arr = read(prefs.getString(KEY, null))
    arr.put(JSONObject().apply {
      put("kind", kind)
      put("value", value)
      put("at", System.currentTimeMillis())
    })
    val trimmed = if (arr.length() > MAX) {
      JSONArray().also { out ->
        for (i in (arr.length() - MAX) until arr.length()) out.put(arr.get(i))
      }
    } else {
      arr
    }
    prefs.edit().putString(KEY, trimmed.toString()).apply()
  }

  /** Devolve a fila como JSON e a esvazia — o app assume a partir daqui. */
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
