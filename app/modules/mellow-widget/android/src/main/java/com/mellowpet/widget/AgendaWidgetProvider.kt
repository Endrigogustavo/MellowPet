package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** AGENDA · 4×1 — o próximo compromisso. */
class AgendaWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, AgendaWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_agenda)
      val next = WidgetStore.getAgenda(context)
      views.setTextViewText(R.id.widget_agenda_dow, next?.dow ?: "---")
      views.setTextViewText(R.id.widget_agenda_day, next?.day ?: "--")
      views.setTextViewText(R.id.widget_agenda_title, next?.title ?: "Nada agendado")
      views.setTextViewText(R.id.widget_agenda_sub, next?.sub ?: "")
      views.setViewVisibility(R.id.widget_agenda_dot, if (next == null) View.INVISIBLE else View.VISIBLE)
      views.setOnClickPendingIntent(R.id.widget_agenda_root, WidgetIntents.openApp(context, 118, "open?screen=agenda"))
      return views
    }
  }
}
