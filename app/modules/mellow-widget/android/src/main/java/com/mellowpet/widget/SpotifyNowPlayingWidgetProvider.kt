package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
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

      views.setInt(R.id.widget_np_root, "setBackgroundResource", WidgetTheme.playlistGlow(emotion))
      views.setTextViewText(R.id.widget_np_source, np.source)
      views.setTextViewText(R.id.widget_np_track, np.track ?: "Nada tocando")
      views.setTextViewText(R.id.widget_np_artist, np.artist ?: "Abra o MellowPet para tocar")
      views.setImageViewResource(R.id.widget_np_playpause,
        if (np.isPaused) R.drawable.wi_play else R.drawable.wi_pause)
      views.setInt(R.id.widget_np_playpause, "setColorFilter", WidgetTheme.playlistColor(emotion))
      views.setProgressBar(R.id.widget_np_bar, 100, np.progress, false)
      // wg-eq do design: as barras só dançam com som saindo de verdade;
      // pausado, mostra a silhueta estática (as alturas 6/13/9/16 do design).
      // Pausado: silhueta estática. Tocando: o flipper com as ondas.
      views.setViewVisibility(R.id.widget_np_eq, if (np.isPaused) View.VISIBLE else View.GONE)
      views.setViewVisibility(R.id.widget_np_eq_anim, if (np.isPaused) View.GONE else View.VISIBLE)

      // Sem abrir o app: fala direto com a sessão de mídia do sistema.
      views.setOnClickPendingIntent(R.id.widget_np_prev,
        WidgetIntents.action(context, 10, WidgetActionReceiver.ACTION_MEDIA, "previous"))
      views.setOnClickPendingIntent(R.id.widget_np_playpause,
        WidgetIntents.action(context, 11, WidgetActionReceiver.ACTION_MEDIA, "toggle"))
      views.setOnClickPendingIntent(R.id.widget_np_next,
        WidgetIntents.action(context, 12, WidgetActionReceiver.ACTION_MEDIA, "next"))
      views.setOnClickPendingIntent(R.id.widget_np_root, WidgetIntents.openApp(context, 13, "open?screen=spotifyplayer"))
      return views
    }
  }
}
