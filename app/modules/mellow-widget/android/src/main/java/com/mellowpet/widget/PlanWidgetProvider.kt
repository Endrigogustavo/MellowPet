package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** PLANO DE 3 PASSOS · 4×2 — o que fazer agora, na ordem. */
class PlanWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PlanWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_plan)
      val mood = WidgetStore.getMood(context)
      val steps = WidgetTheme.plan(mood.emotion)
      val texts = intArrayOf(R.id.widget_plan_t0, R.id.widget_plan_t1, R.id.widget_plan_t2)
      views.setTextViewText(R.id.widget_plan_emo, mood.label)
      views.setTextColor(R.id.widget_plan_emo, WidgetTheme.accent(mood.emotion))
      for (i in 0..2) views.setTextViewText(texts[i], steps.getOrElse(i) { "" })
      views.setOnClickPendingIntent(R.id.widget_plan_root, WidgetIntents.openApp(context, 104, "open?screen=tools"))
      return views
    }
  }
}
