package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** METAS · 2×2 — progresso das metas da semana. */
class GoalsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, GoalsWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_goals)
      val goals = WidgetStore.getGoals(context)
      val names = intArrayOf(R.id.widget_goals_n0, R.id.widget_goals_n1, R.id.widget_goals_n2)
      val vals = intArrayOf(R.id.widget_goals_v0, R.id.widget_goals_v1, R.id.widget_goals_v2)
      val bars = intArrayOf(R.id.widget_goals_b0, R.id.widget_goals_b1, R.id.widget_goals_b2)
      for (i in 0..2) {
        val g = goals.getOrNull(i)
        views.setTextViewText(names[i], g?.name ?: "")
        views.setTextViewText(vals[i], g?.let { "${it.done}/${it.target}" } ?: "")
        views.setProgressBar(bars[i], 100, g?.let { if (it.target > 0) it.done * 100 / it.target else 0 } ?: 0, false)
      }
      views.setOnClickPendingIntent(R.id.widget_goals_root, WidgetIntents.openApp(context, 107, "open?screen=dashboard"))
      return views
    }
  }
}
