package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/** Controle remoto do que está tocando no Spotify — sem abrir o app do
 * Spotify, só o MellowPet (que fala com o Spotify por baixo, como já faz na
 * tela "Tocando agora"). */
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
      val (track, artist, isPaused) = WidgetStore.getNowPlaying(context)
      val views = RemoteViews(context.packageName, R.layout.widget_now_playing)
      views.setTextViewText(R.id.widget_np_track, track ?: "Nada tocando")
      views.setTextViewText(R.id.widget_np_artist, artist ?: "Abra o MellowPet para tocar algo")
      views.setTextViewText(R.id.widget_np_playpause, if (isPaused) "▶" else "⏸")

      views.setOnClickPendingIntent(
        R.id.widget_np_prev,
        WidgetIntents.openApp(context, 10, "spotify?action=previous"),
      )
      views.setOnClickPendingIntent(
        R.id.widget_np_playpause,
        WidgetIntents.openApp(context, 11, "spotify?action=" + if (isPaused) "resume" else "pause"),
      )
      views.setOnClickPendingIntent(
        R.id.widget_np_next,
        WidgetIntents.openApp(context, 12, "spotify?action=next"),
      )
      views.setOnClickPendingIntent(
        R.id.widget_np_root,
        WidgetIntents.openApp(context, 13, "open?screen=spotifyplayer"),
      )
      return views
    }
  }
}
