package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/**
 * MÚSICA · 4×2 — cartão colorido pela playlist do momento, como no design.
 * Controla o que já está tocando sem abrir o app do Spotify: os botões abrem
 * o MellowPet, que é quem fala com o Spotify por baixo.
 */
class SpotifyNowPlayingWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, SpotifyNowPlayingWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val np = WidgetStore.getNowPlaying(context)
      val emotion = WidgetStore.getMood(context).emotion
      val views = RemoteViews(context.packageName, R.layout.widget_now_playing)

      views.setInt(R.id.widget_np_root, "setBackgroundResource", WidgetTheme.playlistCard(emotion))
      views.setTextViewText(R.id.widget_np_source, np.source)
      views.setTextViewText(R.id.widget_np_track, np.track ?: "Nada tocando")
      views.setTextViewText(R.id.widget_np_artist, np.artist ?: "Abra o MellowPet para tocar")
      views.setTextViewText(R.id.widget_np_playpause, if (np.isPaused) "▶" else "⏸")
      views.setTextColor(R.id.widget_np_playpause, WidgetTheme.playlistColor(emotion))
      views.setProgressBar(R.id.widget_np_bar, 100, np.progress, false)
      // O equalizador só faz sentido com som saindo de verdade.
      views.setViewVisibility(R.id.widget_np_eq, if (np.isPaused) android.view.View.INVISIBLE else android.view.View.VISIBLE)

      views.setOnClickPendingIntent(R.id.widget_np_prev, WidgetIntents.openApp(context, 10, "spotify?action=previous"))
      views.setOnClickPendingIntent(
        R.id.widget_np_playpause,
        WidgetIntents.openApp(context, 11, "spotify?action=" + if (np.isPaused) "resume" else "pause"),
      )
      views.setOnClickPendingIntent(R.id.widget_np_next, WidgetIntents.openApp(context, 12, "spotify?action=next"))
      views.setOnClickPendingIntent(R.id.widget_np_root, WidgetIntents.openApp(context, 13, "open?screen=spotifyplayer"))
      return views
    }
  }
}
