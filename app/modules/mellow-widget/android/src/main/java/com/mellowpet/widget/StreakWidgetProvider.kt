package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/** SEQUÊNCIA · 2×2 — cartão roxo com os dias seguidos e a semana em
 * pontinhos, como no design. */
class StreakWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    private val WEEK = intArrayOf(
      R.id.widget_streak_d0, R.id.widget_streak_d1, R.id.widget_streak_d2, R.id.widget_streak_d3,
      R.id.widget_streak_d4, R.id.widget_streak_d5, R.id.widget_streak_d6,
    )

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, StreakWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val days = WidgetStore.getStreakDays(context)
      val week = WidgetStore.getStreakWeek(context)
      val views = RemoteViews(context.packageName, R.layout.widget_streak)

      views.setTextViewText(R.id.widget_streak_count, days.toString())
      views.setTextViewText(R.id.widget_streak_sub, if (days == 1) "dia seguido" else "dias seguidos")
      WEEK.forEachIndexed { i, id ->
        views.setImageViewResource(
          id,
          if (week.getOrElse(i) { false }) R.drawable.widget_week_on else R.drawable.widget_week_off,
        )
      }
      views.setOnClickPendingIntent(R.id.widget_streak_root, WidgetIntents.openApp(context, 50, "open?screen=dashboard"))
      return views
    }
  }
}
