package com.mellowpet.widget

import android.content.Context

/** SharedPreferences simples — o widget roda num processo separado do app
 * (o do launcher), então os dois só se falam por algo persistido, não por
 * uma variável em memória. */
internal object WidgetStore {
  private const val PREFS = "mellow_widget_prefs"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setMood(context: Context, emoji: String, label: String, sub: String) {
    prefs(context).edit()
      .putString("mood_emoji", emoji)
      .putString("mood_label", label)
      .putString("mood_sub", sub)
      .apply()
  }

  fun getMood(context: Context): Triple<String, String, String> {
    val p = prefs(context)
    return Triple(
      p.getString("mood_emoji", "🙂") ?: "🙂",
      p.getString("mood_label", "Mellow") ?: "Mellow",
      p.getString("mood_sub", "Toque para abrir") ?: "Toque para abrir",
    )
  }

  fun setNowPlaying(context: Context, track: String?, artist: String?, isPaused: Boolean) {
    prefs(context).edit()
      .putString("np_track", track)
      .putString("np_artist", artist)
      .putBoolean("np_paused", isPaused)
      .apply()
  }

  fun getNowPlaying(context: Context): Triple<String?, String?, Boolean> {
    val p = prefs(context)
    return Triple(p.getString("np_track", null), p.getString("np_artist", null), p.getBoolean("np_paused", true))
  }

  fun setRoutine(context: Context, time: String?, name: String?) {
    prefs(context).edit()
      .putString("routine_time", time)
      .putString("routine_name", name)
      .apply()
  }

  fun getRoutine(context: Context): Pair<String?, String?> {
    val p = prefs(context)
    return Pair(p.getString("routine_time", null), p.getString("routine_name", null))
  }
}
