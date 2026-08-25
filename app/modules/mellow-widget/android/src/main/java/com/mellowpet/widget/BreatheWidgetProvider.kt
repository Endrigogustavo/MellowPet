package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** RESPIRAÇÃO · 2×2 — atalho para o exercício guiado. */
class BreatheWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, BreatheWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_breathe)
      val mood = WidgetStore.getMood(context)
      views.setInt(R.id.widget_breathe_root, "setBackgroundResource", WidgetTheme.tintBackground(mood.emotion))
      views.setOnClickPendingIntent(R.id.widget_breathe_root, WidgetIntents.openApp(context, 105, "tool?action=breathe"))
      return views
    }
  }
}
