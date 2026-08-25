package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** PRÓXIMO PASSO · 4×1 — a sugestão do Mellow para agora. */
class NextStepWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, NextStepWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_next_step)
      val mood = WidgetStore.getMood(context)
      val step = WidgetTheme.nextStep(mood.emotion)
      views.setInt(R.id.widget_next_root, "setBackgroundResource", WidgetTheme.tint26(mood.emotion))
      views.setImageViewResource(R.id.widget_next_icon, step.icon)
      views.setTextViewText(R.id.widget_next_title, step.title)
      views.setTextViewText(R.id.widget_next_sub, step.sub)
      views.setOnClickPendingIntent(R.id.widget_next_root, WidgetIntents.openApp(context, 120, "open?screen=tools"))
      return views
    }
  }
}
