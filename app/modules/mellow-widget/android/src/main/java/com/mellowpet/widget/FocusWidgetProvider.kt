package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** FOCO · 2×2 — sessão de foco com o tempo restante. */
class FocusWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, FocusWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_focus)
      val focus = WidgetStore.getFocus(context)
      views.setProgressBar(R.id.widget_focus_ring, 100, focus.percent, false)
      views.setTextViewText(R.id.widget_focus_time, focus.label)
      views.setTextViewText(R.id.widget_focus_label, if (focus.running) "Em foco" else "Modo foco")
      views.setOnClickPendingIntent(R.id.widget_focus_root, WidgetIntents.openApp(context, 109, "tool?action=focus"))
      return views
    }
  }
}
