package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** ALERTA DO CUIDADOR · 4×1 — o padrão que merece atenção. */
class CareAlertWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CareAlertWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_care_alert)
      val alert = WidgetStore.getAlert(context)
      views.setTextViewText(R.id.widget_alert_title, alert?.title ?: "Nenhum alerta")
      views.setTextViewText(R.id.widget_alert_sub, alert?.sub ?: "tudo dentro do padrão")
      views.setOnClickPendingIntent(R.id.widget_alert_root, WidgetIntents.openApp(context, 121, "open?screen=care"))
      return views
    }
  }
}
