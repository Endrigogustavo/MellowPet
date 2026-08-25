package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** ÁGUA · 2×1 — copos do dia. */
class WaterWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, WaterWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_water)
      val glasses = WidgetStore.getWater(context)
      val ids = intArrayOf(R.id.widget_glass0, R.id.widget_glass1, R.id.widget_glass2,
        R.id.widget_glass3, R.id.widget_glass4, R.id.widget_glass5)
      ids.forEachIndexed { i, id ->
        views.setImageViewResource(id,
          if (i < glasses) R.drawable.widget_bar_water_on else R.drawable.widget_bar_water_off)
      }
      views.setTextViewText(R.id.widget_water_label, "$glasses de 6 copos")
      views.setOnClickPendingIntent(R.id.widget_water_root, WidgetIntents.action(context, 125, WidgetActionReceiver.ACTION_WATER))
      return views
    }
  }
}
