package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** CHECK-IN COMBINADO · 2×2 — o combinado com quem cuida de você. */
class CheckinWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CheckinWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_checkin)
      val checkin = WidgetStore.getCheckin(context)
      views.setTextViewText(R.id.widget_checkin_when, checkin?.whenLabel ?: "SEM COMBINADO")
      views.setTextViewText(R.id.widget_checkin_title, checkin?.title ?: "Nenhum check-in")
      views.setTextViewText(R.id.widget_checkin_q, checkin?.question ?: "Combine um com quem cuida de você.")
      views.setOnClickPendingIntent(R.id.widget_checkin_btn, WidgetIntents.openApp(context, 310, "open?screen=care"))
      views.setOnClickPendingIntent(R.id.widget_checkin_root, WidgetIntents.openApp(context, 114, "open?screen=care"))
      return views
    }
  }
}
