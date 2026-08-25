package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** PLAYLISTS · 2×2 — as playlists de momento, cada uma na sua cor. */
class PlaylistsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PlaylistsWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_playlists)
      val lists = WidgetStore.getPlaylists(context)
      val names = intArrayOf(R.id.widget_pl_name0, R.id.widget_pl_name1, R.id.widget_pl_name2, R.id.widget_pl_name3)
      val dots = intArrayOf(R.id.widget_pl_dot0, R.id.widget_pl_dot1, R.id.widget_pl_dot2, R.id.widget_pl_dot3)
      val cells = intArrayOf(R.id.widget_pl_cell0, R.id.widget_pl_cell1, R.id.widget_pl_cell2, R.id.widget_pl_cell3)
      for (i in 0..3) {
        val pl = lists.getOrNull(i)
        views.setTextViewText(names[i], pl?.name ?: "")
        views.setInt(dots[i], "setBackgroundResource", WidgetTheme.playlistRound(pl?.emotion ?: "neutral"))
        views.setViewVisibility(dots[i], if (pl == null) View.INVISIBLE else View.VISIBLE)
        views.setOnClickPendingIntent(cells[i],
          WidgetIntents.openApp(context, 300 + i, if (pl == null) "open?screen=music" else "playlist?id=${pl.id}"))
      }
      views.setOnClickPendingIntent(R.id.widget_playlists_root, WidgetIntents.openApp(context, 113, "open?screen=music"))
      return views
    }
  }
}
