package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** GATILHOS · 2×2 — os padrões que mais se repetiram. */
class TriggersWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TriggersWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_triggers)
      val triggers = WidgetStore.getTriggers(context)
      val names = intArrayOf(R.id.widget_triggers_n0, R.id.widget_triggers_n1, R.id.widget_triggers_n2)
      val vals = intArrayOf(R.id.widget_triggers_v0, R.id.widget_triggers_v1, R.id.widget_triggers_v2)
      val bars = intArrayOf(R.id.widget_triggers_b0, R.id.widget_triggers_b1, R.id.widget_triggers_b2)
      val top = triggers.maxOfOrNull { it.count } ?: 1
      for (i in 0..2) {
        val t = triggers.getOrNull(i)
        views.setTextViewText(names[i], t?.name ?: "")
        views.setTextViewText(vals[i], t?.let { "${it.count}x" } ?: "")
        views.setProgressBar(bars[i], 100, t?.let { it.count * 100 / top.coerceAtLeast(1) } ?: 0, false)
      }
      views.setOnClickPendingIntent(R.id.widget_triggers_root, WidgetIntents.openApp(context, 108, "open?screen=dashboard"))
      return views
    }
  }
}
