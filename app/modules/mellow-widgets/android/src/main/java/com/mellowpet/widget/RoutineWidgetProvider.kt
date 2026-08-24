package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import com.mellowpet.widgetbridge.R

/** Próximo item da rotina do dia, direto na tela inicial. */
class RoutineWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, RoutineWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val (time, name) = WidgetStore.getRoutine(context)
      val views = RemoteViews(context.packageName, R.layout.widget_routine)
      views.setTextViewText(R.id.widget_routine_time, time ?: "--:--")
      views.setTextViewText(R.id.widget_routine_name, name ?: "Nada agendado ainda")
      views.setOnClickPendingIntent(R.id.widget_routine_root, WidgetIntents.openApp(context, 20, "open?screen=routine"))
      return views
    }
  }
}
