package com.mellowpet.widget

import android.content.Context

/**
 * SharedPreferences simples — o widget roda num processo separado do app
 * (o do launcher), então os dois só se falam por algo persistido, não por
 * uma variável em memória.
 *
 * Listas viram chaves indexadas (`chave_0`, `chave_1`…) em vez de JSON: são
 * poucos itens de tamanho fixo, e ler assim dispensa parser no widget.
 */
internal object WidgetStore {
  private const val PREFS = "mellow_widget_prefs"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /* ── humor / bichinho ──────────────────────────────────────────────── */

  data class Mood(
    val emotion: String,
    val label: String,
    val level: Int,
    val progress: Int,
    val moodPct: Int,
    val petName: String,
    val hunger: String,
    val pets: Int,
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
    pets: Int,
  ) {
    prefs(context).edit()
      .putString("mood_emotion", emotion)
      .putString("mood_label", label)
      .putInt("mood_level", level)
      .putInt("mood_progress", progress)
      .putInt("mood_pct", moodPct)
      .putString("pet_name", petName)
      .putString("pet_hunger", hunger)
      .putInt("pet_pets", pets)
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
      p.getInt("pet_pets", 0),
    )
  }

  /* ── música ────────────────────────────────────────────────────────── */

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

  data class Playlist(val id: String, val name: String, val emotion: String)

  fun setPlaylists(context: Context, ids: List<String>, names: List<String>, emotions: List<String>) {
    val e = prefs(context).edit().putInt("pl_count", names.size.coerceAtMost(4))
    for (i in 0 until names.size.coerceAtMost(4)) {
      e.putString("pl_id_$i", ids.getOrElse(i) { "" })
      e.putString("pl_name_$i", names[i])
      e.putString("pl_emo_$i", emotions.getOrElse(i) { "neutral" })
    }
    e.apply()
  }

  fun getPlaylists(context: Context): List<Playlist> {
    val p = prefs(context)
    return (0 until p.getInt("pl_count", 0).coerceIn(0, 4)).mapNotNull { i ->
      val name = p.getString("pl_name_$i", null) ?: return@mapNotNull null
      Playlist(p.getString("pl_id_$i", "") ?: "", name, p.getString("pl_emo_$i", "neutral") ?: "neutral")
    }
  }

  /* ── rotina / agenda ───────────────────────────────────────────────── */

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
    return (0 until p.getInt("routine_count", 0).coerceIn(0, 3)).mapNotNull { i ->
      val time = p.getString("routine_time_$i", null) ?: return@mapNotNull null
      RoutineItem(time, p.getString("routine_name_$i", "") ?: "",
        p.getString("routine_state_$i", "todo") ?: "todo")
    }
  }

  data class Agenda(val dow: String, val day: String, val title: String, val sub: String)

  fun setAgenda(context: Context, dow: String?, day: String?, title: String?, sub: String?) {
    prefs(context).edit()
      .putString("ag_dow", dow).putString("ag_day", day)
      .putString("ag_title", title).putString("ag_sub", sub).apply()
  }

  fun getAgenda(context: Context): Agenda? {
    val p = prefs(context)
    val title = p.getString("ag_title", null) ?: return null
    return Agenda(p.getString("ag_dow", "") ?: "", p.getString("ag_day", "") ?: "",
      title, p.getString("ag_sub", "") ?: "")
  }

  /* ── painel ────────────────────────────────────────────────────────── */

  /** -1 = ainda sem leituras suficientes para um índice honesto. */
  fun setWellbeing(context: Context, score: Int) {
    prefs(context).edit().putInt("wb_score", score).apply()
  }

  fun getWellbeing(context: Context): Int = prefs(context).getInt("wb_score", -1)

  data class TimelineSlot(val hour: String, val emotion: String)

  fun setTimeline(context: Context, hours: List<String>, emotions: List<String>) {
    val e = prefs(context).edit().putInt("tl_count", hours.size.coerceAtMost(8))
    for (i in 0 until hours.size.coerceAtMost(8)) {
      e.putString("tl_h_$i", hours[i])
      e.putString("tl_e_$i", emotions.getOrElse(i) { "neutral" })
    }
    e.apply()
  }

  fun getTimeline(context: Context): List<TimelineSlot> {
    val p = prefs(context)
    return (0 until p.getInt("tl_count", 0).coerceIn(0, 8)).mapNotNull { i ->
      val h = p.getString("tl_h_$i", null) ?: return@mapNotNull null
      TimelineSlot(h, p.getString("tl_e_$i", "neutral") ?: "neutral")
    }
  }

  data class Trigger(val name: String, val count: Int)

  fun setTriggers(context: Context, names: List<String>, counts: List<Int>) {
    val e = prefs(context).edit().putInt("tg_count", names.size.coerceAtMost(3))
    for (i in 0 until names.size.coerceAtMost(3)) {
      e.putString("tg_n_$i", names[i])
      e.putInt("tg_c_$i", counts.getOrElse(i) { 0 })
    }
    e.apply()
  }

  fun getTriggers(context: Context): List<Trigger> {
    val p = prefs(context)
    return (0 until p.getInt("tg_count", 0).coerceIn(0, 3)).mapNotNull { i ->
      val n = p.getString("tg_n_$i", null) ?: return@mapNotNull null
      Trigger(n, p.getInt("tg_c_$i", 0))
    }
  }

  data class Goal(val name: String, val done: Int, val target: Int)

  fun setGoals(context: Context, names: List<String>, done: List<Int>, target: List<Int>) {
    val e = prefs(context).edit().putInt("gl_count", names.size.coerceAtMost(3))
    for (i in 0 until names.size.coerceAtMost(3)) {
      e.putString("gl_n_$i", names[i])
      e.putInt("gl_d_$i", done.getOrElse(i) { 0 })
      e.putInt("gl_t_$i", target.getOrElse(i) { 1 })
    }
    e.apply()
  }

  fun getGoals(context: Context): List<Goal> {
    val p = prefs(context)
    return (0 until p.getInt("gl_count", 0).coerceIn(0, 3)).mapNotNull { i ->
      val n = p.getString("gl_n_$i", null) ?: return@mapNotNull null
      Goal(n, p.getInt("gl_d_$i", 0), p.getInt("gl_t_$i", 1))
    }
  }

  /** Décimos de hora por noite (75 = 7,5h); 0 = sem registro. */
  fun setSleep(context: Context, nights: List<Int>) {
    val e = prefs(context).edit()
    for (i in 0 until 7) e.putInt("sl_$i", nights.getOrElse(i) { 0 })
    e.apply()
  }

  fun getSleep(context: Context): List<Int> {
    val p = prefs(context)
    return (0 until 7).map { p.getInt("sl_$it", 0) }
  }

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

  fun setBadges(context: Context, unlocked: List<Boolean>) {
    val e = prefs(context).edit()
    for (i in 0 until 6) e.putBoolean("bd_$i", unlocked.getOrElse(i) { false })
    e.apply()
  }

  fun getBadges(context: Context): List<Boolean> {
    val p = prefs(context)
    return (0 until 6).map { p.getBoolean("bd_$it", false) }
  }

  /* ── cuidador ──────────────────────────────────────────────────────── */

  data class Person(val name: String, val state: String, val wellbeing: Int)

  fun setPeople(context: Context, names: List<String>, states: List<String>, wb: List<Int>) {
    val e = prefs(context).edit().putInt("pp_count", names.size.coerceAtMost(2))
    for (i in 0 until names.size.coerceAtMost(2)) {
      e.putString("pp_n_$i", names[i])
      e.putString("pp_s_$i", states.getOrElse(i) { "" })
      e.putInt("pp_w_$i", wb.getOrElse(i) { 0 })
    }
    e.apply()
  }

  fun getPeople(context: Context): List<Person> {
    val p = prefs(context)
    return (0 until p.getInt("pp_count", 0).coerceIn(0, 2)).mapNotNull { i ->
      val n = p.getString("pp_n_$i", null) ?: return@mapNotNull null
      Person(n, p.getString("pp_s_$i", "") ?: "", p.getInt("pp_w_$i", 0))
    }
  }

  data class Alert(val title: String, val sub: String)

  fun setAlert(context: Context, title: String?, sub: String?) {
    prefs(context).edit().putString("al_t", title).putString("al_s", sub).apply()
  }

  fun getAlert(context: Context): Alert? {
    val p = prefs(context)
    val t = p.getString("al_t", null) ?: return null
    return Alert(t, p.getString("al_s", "") ?: "")
  }

  fun getCareAlert(context: Context): String? = getAlert(context)?.let { "${it.title} · ${it.sub}" }

  data class Checkin(val whenLabel: String, val title: String, val question: String)

  fun setCheckin(context: Context, whenLabel: String?, title: String?, question: String?) {
    prefs(context).edit()
      .putString("ci_w", whenLabel).putString("ci_t", title).putString("ci_q", question).apply()
  }

  fun getCheckin(context: Context): Checkin? {
    val p = prefs(context)
    val t = p.getString("ci_t", null) ?: return null
    return Checkin(p.getString("ci_w", "") ?: "", t, p.getString("ci_q", "") ?: "")
  }

  /* ── diversos ──────────────────────────────────────────────────────── */

  data class Focus(val percent: Int, val label: String, val running: Boolean)

  fun setFocus(context: Context, percent: Int, label: String, running: Boolean) {
    prefs(context).edit()
      .putInt("fc_p", percent).putString("fc_l", label).putBoolean("fc_r", running).apply()
  }

  fun getFocus(context: Context): Focus {
    val p = prefs(context)
    return Focus(p.getInt("fc_p", 0), p.getString("fc_l", "25:00") ?: "25:00", p.getBoolean("fc_r", false))
  }

  fun setWater(context: Context, glasses: Int) {
    prefs(context).edit().putInt("water", glasses.coerceIn(0, 6)).apply()
  }

  fun getWater(context: Context): Int = prefs(context).getInt("water", 0)

  fun setJournalTag(context: Context, tag: String) {
    prefs(context).edit().putString("jr_tag", tag).apply()
  }

  fun getJournalTag(context: Context): String = prefs(context).getString("jr_tag", "Alívio") ?: "Alívio"

  fun setCapsule(context: Context, sub: String?) {
    prefs(context).edit().putString("cp_sub", sub).apply()
  }

  fun getCapsule(context: Context): String? = prefs(context).getString("cp_sub", null)
}
