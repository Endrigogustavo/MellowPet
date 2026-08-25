package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** LINHA DO DIA · 4×2 — a emoção dominante de cada faixa do dia. */
class TimelineWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TimelineWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_timeline)
      val slots = WidgetStore.getTimeline(context)
      val bars = intArrayOf(R.id.widget_tl_bar0, R.id.widget_tl_bar1, R.id.widget_tl_bar2, R.id.widget_tl_bar3,
        R.id.widget_tl_bar4, R.id.widget_tl_bar5, R.id.widget_tl_bar6, R.id.widget_tl_bar7)
      val hours = intArrayOf(R.id.widget_tl_hour0, R.id.widget_tl_hour1, R.id.widget_tl_hour2, R.id.widget_tl_hour3,
        R.id.widget_tl_hour4, R.id.widget_tl_hour5, R.id.widget_tl_hour6, R.id.widget_tl_hour7)
      for (i in 0..7) {
        val slot = slots.getOrNull(i)
        views.setTextViewText(hours[i], slot?.hour ?: "")
        views.setImageViewResource(bars[i], WidgetTheme.barFor(slot?.emotion ?: "neutral"))
        // Sem leitura naquela hora a barra some, em vez de fingir um valor.
        views.setViewVisibility(bars[i], if (slot == null) View.INVISIBLE else View.VISIBLE)
      }
      views.setOnClickPendingIntent(R.id.widget_timeline_root, WidgetIntents.openApp(context, 101, "open?screen=dashboard"))
      return views
    }
  }
}
