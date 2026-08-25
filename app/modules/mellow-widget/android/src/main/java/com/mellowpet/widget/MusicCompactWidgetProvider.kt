package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** MÚSICA COMPACTA · 4×1 — a faixa atual em faixa fina. */
class MusicCompactWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, MusicCompactWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_music_compact)
      val np = WidgetStore.getNowPlaying(context)
      val emotion = WidgetStore.getMood(context).emotion
      views.setTextViewText(R.id.widget_mc_track, np.track ?: "Nada tocando")
      views.setTextViewText(R.id.widget_mc_playlist, np.artist ?: "Toque para escolher")
      views.setInt(R.id.widget_mc_art, "setBackgroundResource", WidgetTheme.playlistBlock(emotion))
      views.setInt(R.id.widget_mc_btn, "setBackgroundResource", WidgetTheme.playlistRound(emotion))
      views.setTextViewText(R.id.widget_mc_btn, if (np.isPaused) "▶" else "⏸")
      views.setOnClickPendingIntent(R.id.widget_mc_btn, WidgetIntents.openApp(context, 340,
        "spotify?action=" + if (np.isPaused) "resume" else "pause"))
      views.setOnClickPendingIntent(R.id.widget_mc_root, WidgetIntents.openApp(context, 119, "open?screen=spotifyplayer"))
      return views
    }
  }
}
