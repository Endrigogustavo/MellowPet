package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** CARINHO · 2×1 — um toque para fazer carinho no Mellow. */
class PetTapWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PetTapWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_pet_tap)
      val mood = WidgetStore.getMood(context)
      views.setInt(R.id.widget_pettap_root, "setBackgroundResource", WidgetTheme.tint26(mood.emotion))
      views.setTextViewText(R.id.widget_pettap_count, "${mood.pets} hoje")
      views.setOnClickPendingIntent(R.id.widget_pettap_root, WidgetIntents.openApp(context, 122, "care?action=pet"))
      return views
    }
  }
}
