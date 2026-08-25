package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** SONO · 2×2 — as sete últimas noites e a média. */
class SleepWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, SleepWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_sleep)
      val nights = WidgetStore.getSleep(context)
      val bars = intArrayOf(R.id.widget_sleep_b0, R.id.widget_sleep_b1, R.id.widget_sleep_b2,
        R.id.widget_sleep_b3, R.id.widget_sleep_b4, R.id.widget_sleep_b5, R.id.widget_sleep_b6)
      val days = intArrayOf(R.id.widget_sleep_d0, R.id.widget_sleep_d1, R.id.widget_sleep_d2,
        R.id.widget_sleep_d3, R.id.widget_sleep_d4, R.id.widget_sleep_d5, R.id.widget_sleep_d6)
      val labels = arrayOf("S", "T", "Q", "Q", "S", "S", "D")
      for (i in 0..6) {
        views.setTextViewText(days[i], labels[i])
        views.setViewVisibility(bars[i], if (nights.getOrElse(i) { 0 } > 0) View.VISIBLE else View.INVISIBLE)
      }
      val logged = nights.filter { it > 0 }
      views.setTextViewText(R.id.widget_sleep_avg,
        if (logged.isEmpty()) "--" else String.format("%.1fh", logged.average() / 10.0))
      views.setOnClickPendingIntent(R.id.widget_sleep_root, WidgetIntents.openApp(context, 111, "open?screen=routine"))
      return views
    }
  }
}
