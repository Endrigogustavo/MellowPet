package com.mellowpet.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.SystemClock
import android.view.KeyEvent

/**
 * Executa a ação do widget no lugar, sem abrir o app.
 *
 * Um widget roda no processo do launcher, então nada daqui enxerga a sessão
 * do Supabase nem o App Remote do Spotify. Duas saídas:
 *
 *  - Playback: `dispatchMediaKeyEvent` fala com a sessão de mídia ativa do
 *    sistema (o Spotify, no caso). Não precisa de permissão nem do app
 *    aberto — é o mesmo caminho dos botões do fone.
 *  - Registros (carinho, água, sentimento): gravam local na hora, para o
 *    widget responder no mesmo instante, e entram numa fila que o app
 *    sincroniza com o Supabase quando abrir. Ver PendingActions.
 */
class WidgetActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_MEDIA -> media(context, intent.getStringExtra(EXTRA_VALUE))
      ACTION_WATER -> water(context)
      ACTION_PET -> pet(context)
      ACTION_MOOD -> mood(context, intent.getStringExtra(EXTRA_VALUE))
      ACTION_VISION -> vision(context, intent.getStringExtra(EXTRA_EMOTION))
    }
  }

  /** Leitura vinda do serviço de visão em segundo plano. Mesmo caminho do
   * registro manual, mas marcada como automática na fila — o app precisa
   * saber que veio da câmera, não de um toque. */
  private fun vision(context: Context, emotion: String?) {
    if (emotion == null) return
    val m = WidgetStore.getMood(context)
    WidgetStore.setMood(context, emotion, WidgetTheme.label(emotion), m.level, m.progress,
      WidgetTheme.moodPct(emotion), m.petName, m.hunger, m.pets)
    PendingActions.add(context, "vision", emotion)
    redrawMoodDependent(context)
  }

  private fun media(context: Context, action: String?) {
    val code = when (action) {
      "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
      "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
      // Um único código alterna: o próprio player sabe se está tocando.
      else -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
    }
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    val now = SystemClock.uptimeMillis()
    audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0))
    audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0))

    if (action == null || action == "toggle") {
      // Espelha o novo estado na hora. O app corrige quando reconectar ao
      // App Remote — aqui não dá para perguntar ao Spotify como ele ficou.
      val np = WidgetStore.getNowPlaying(context)
      WidgetStore.setNowPlaying(context, np.track, np.artist, !np.isPaused, np.source, np.progress)
    }
    SpotifyNowPlayingWidgetProvider.updateAll(context)
    MusicCompactWidgetProvider.updateAll(context)
  }

  private fun water(context: Context) {
    val next = (WidgetStore.getWater(context) + 1) % 7
    WidgetStore.setWater(context, next)
    PendingActions.add(context, "water", next.toString())
    WaterWidgetProvider.updateAll(context)
  }

  private fun pet(context: Context) {
    val mood = WidgetStore.getMood(context)
    WidgetStore.setMood(context, mood.emotion, mood.label, mood.level, mood.progress,
      mood.moodPct, mood.petName, mood.hunger, mood.pets + 1)
    PendingActions.add(context, "pet", "1")
    PetTapWidgetProvider.updateAll(context)
    HeroWidgetProvider.updateAll(context)
    CareWidgetProvider.updateAll(context)
  }

  private fun mood(context: Context, value: String?) {
    if (value == null) return
    val m = WidgetStore.getMood(context)
    WidgetStore.setMood(context, value, WidgetTheme.label(value), m.level, m.progress,
      WidgetTheme.moodPct(value), m.petName, m.hunger, m.pets)
    PendingActions.add(context, "mood", value)
    redrawMoodDependent(context)
  }

  /** O sentimento tinge quase todos os widgets — redesenha o conjunto. */
  private fun redrawMoodDependent(context: Context) {
    MellowMoodWidgetProvider.updateAll(context)
    HeroWidgetProvider.updateAll(context)
    CareWidgetProvider.updateAll(context)
    QuoteWidgetProvider.updateAll(context)
    PlanWidgetProvider.updateAll(context)
    NextStepWidgetProvider.updateAll(context)
    BreatheWidgetProvider.updateAll(context)
    PetTapWidgetProvider.updateAll(context)
    LevelWidgetProvider.updateAll(context)
    SpotifyNowPlayingWidgetProvider.updateAll(context)
    MusicCompactWidgetProvider.updateAll(context)
  }

  companion object {
    const val ACTION_MEDIA = "com.mellowpet.widget.MEDIA"
    const val ACTION_WATER = "com.mellowpet.widget.WATER"
    const val ACTION_PET = "com.mellowpet.widget.PET"
    const val ACTION_MOOD = "com.mellowpet.widget.MOOD"
    const val ACTION_VISION = "com.mellowpet.widget.VISION_READING"
    const val EXTRA_VALUE = "value"
    const val EXTRA_EMOTION = "emotion"
  }
}
