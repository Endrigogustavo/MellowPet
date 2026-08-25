package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** CASA CONECTADA · 4×1 — atalhos de ambiente. */
class HomeDevicesWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, HomeDevicesWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_home_devices)
      val ids = intArrayOf(R.id.widget_home0, R.id.widget_home1, R.id.widget_home2, R.id.widget_home3)
      ids.forEachIndexed { i, id ->
        views.setOnClickPendingIntent(id, WidgetIntents.openApp(context, 330 + i, "open?screen=settings"))
      }
      views.setOnClickPendingIntent(R.id.widget_home_root, WidgetIntents.openApp(context, 116, "open?screen=settings"))
      return views
    }
  }
}
