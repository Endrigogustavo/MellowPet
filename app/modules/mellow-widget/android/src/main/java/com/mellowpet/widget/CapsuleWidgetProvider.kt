package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** CÁPSULA · 2×1 — a carta selada para o seu eu de daqui a um mês. */
class CapsuleWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CapsuleWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_capsule)
      views.setTextViewText(R.id.widget_capsule_sub, WidgetStore.getCapsule(context) ?: "nada selado")
      views.setOnClickPendingIntent(R.id.widget_capsule_root, WidgetIntents.openApp(context, 124, "open?screen=routine"))
      return views
    }
  }
}
