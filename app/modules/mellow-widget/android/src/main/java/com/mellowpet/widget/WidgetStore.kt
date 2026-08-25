package com.mellowpet.widget

import android.content.Context

/** SharedPreferences simples — o widget roda num processo separado do app
 * (o do launcher), então os dois só se falam por algo persistido, não por
 * uma variável em memória. */
internal object WidgetStore {
  private const val PREFS = "mellow_widget_prefs"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  data class Mood(
    val emotion: String,
    val label: String,
    val level: Int,
    val progress: Int,
    val moodPct: Int,
    val petName: String,
    val hunger: String,
  )

  fun setMood(
    context: Context,
    emotion: String,
    label: String,
    level: Int,
    progress: Int,
    moodPct: Int,
    petName: String,
    hunger: String,
  ) {
    prefs(context).edit()
      .putString("mood_emotion", emotion)
      .putString("mood_label", label)
      .putInt("mood_level", level)
      .putInt("mood_progress", progress)
      .putInt("mood_pct", moodPct)
      .putString("pet_name", petName)
      .putString("pet_hunger", hunger)
      .apply()
  }

  fun getMood(context: Context): Mood {
    val p = prefs(context)
    return Mood(
      p.getString("mood_emotion", "neutral") ?: "neutral",
      p.getString("mood_label", "Sem leitura") ?: "Sem leitura",
      p.getInt("mood_level", 1),
      p.getInt("mood_progress", 0),
      p.getInt("mood_pct", 0),
      p.getString("pet_name", "Mellow") ?: "Mellow",
      p.getString("pet_hunger", "quer atenção") ?: "quer atenção",
    )
  }

  data class NowPlaying(
    val track: String?,
    val artist: String?,
    val isPaused: Boolean,
    val source: String,
    val progress: Int,
  )

  fun setNowPlaying(
    context: Context,
    track: String?,
    artist: String?,
    isPaused: Boolean,
    source: String,
    progress: Int,
  ) {
    prefs(context).edit()
      .putString("np_track", track)
      .putString("np_artist", artist)
      .putBoolean("np_paused", isPaused)
      .putString("np_source", source)
      .putInt("np_progress", progress)
      .apply()
  }

  fun getNowPlaying(context: Context): NowPlaying {
    val p = prefs(context)
    return NowPlaying(
      p.getString("np_track", null),
      p.getString("np_artist", null),
      p.getBoolean("np_paused", true),
      p.getString("np_source", "SPOTIFY") ?: "SPOTIFY",
      p.getInt("np_progress", 0),
    )
  }

  /** Até três itens da rotina, cada um com estado (feito/agora/a fazer). */
  data class RoutineItem(val time: String, val name: String, val state: String)

  fun setRoutine(context: Context, items: List<RoutineItem>) {
    val e = prefs(context).edit().putInt("routine_count", items.size.coerceAtMost(3))
    items.take(3).forEachIndexed { i, item ->
      e.putString("routine_time_$i", item.time)
      e.putString("routine_name_$i", item.name)
      e.putString("routine_state_$i", item.state)
    }
    e.apply()
  }

  fun getRoutine(context: Context): List<RoutineItem> {
    val p = prefs(context)
    val count = p.getInt("routine_count", 0).coerceIn(0, 3)
    return (0 until count).mapNotNull { i ->
      val time = p.getString("routine_time_$i", null) ?: return@mapNotNull null
      RoutineItem(
        time,
        p.getString("routine_name_$i", "") ?: "",
        p.getString("routine_state_$i", "todo") ?: "todo",
      )
    }
  }

  /** Sequência: dias seguidos + quais dias da semana tiveram registro. */
  fun setStreak(context: Context, days: Int, week: List<Boolean>) {
    val e = prefs(context).edit().putInt("streak_days", days)
    week.take(7).forEachIndexed { i, on -> e.putBoolean("streak_w$i", on) }
    e.apply()
  }

  fun getStreakDays(context: Context): Int = prefs(context).getInt("streak_days", 0)

  fun getStreakWeek(context: Context): List<Boolean> {
    val p = prefs(context)
    return (0 until 7).map { p.getBoolean("streak_w$it", false) }
  }
}
