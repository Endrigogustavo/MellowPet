package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** FERRAMENTAS · 4×1 — os cinco atalhos rápidos. */
class ToolsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, ToolsWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_tools)
      val tools = arrayOf("breathe", "ground", "journal", "chat", "stretch")
      val ids = intArrayOf(R.id.widget_tool0, R.id.widget_tool1, R.id.widget_tool2, R.id.widget_tool3, R.id.widget_tool4)
      ids.forEachIndexed { i, id ->
        views.setOnClickPendingIntent(id, WidgetIntents.openApp(context, 320 + i, "tool?action=${tools[i]}"))
      }
      views.setOnClickPendingIntent(R.id.widget_tools_root, WidgetIntents.openApp(context, 115, "open?screen=tools"))
      return views
    }
  }
}
