package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** CONQUISTAS · 2×2 — as seis medalhas do app. */
class BadgesWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, BadgesWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_badges)
      val unlocked = WidgetStore.getBadges(context)
      val slots = intArrayOf(R.id.widget_badge0, R.id.widget_badge1, R.id.widget_badge2,
        R.id.widget_badge3, R.id.widget_badge4, R.id.widget_badge5)
      slots.forEachIndexed { i, id ->
        val on = unlocked.getOrElse(i) { false }
        views.setInt(id, "setBackgroundResource",
          if (on) R.drawable.widget_badge_on else R.drawable.widget_badge_off)
        views.setInt(id, "setImageAlpha", if (on) 255 else 90)
      }
      views.setTextViewText(R.id.widget_badges_sub, "${unlocked.count { it }} de 6 desbloqueadas")
      views.setOnClickPendingIntent(R.id.widget_badges_root, WidgetIntents.openApp(context, 110, "open?screen=home"))
      return views
    }
  }
}
