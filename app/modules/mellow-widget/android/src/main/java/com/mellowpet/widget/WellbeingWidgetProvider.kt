package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** BEM-ESTAR · 2×2 — o índice do dia num anel. */
class WellbeingWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, WellbeingWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_wellbeing)
      val score = WidgetStore.getWellbeing(context)
      views.setProgressBar(R.id.widget_wb_ring, 100, score.coerceAtLeast(0), false)
      views.setTextViewText(R.id.widget_wb_score, if (score < 0) "--" else score.toString())
      views.setOnClickPendingIntent(R.id.widget_wb_root, WidgetIntents.openApp(context, 106, "open?screen=dashboard"))
      return views
    }
  }
}
