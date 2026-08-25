package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/**
 * CUIDAR DO MELLOW · 4×2 — avatar, humor% e as três ações do design.
 * Alimentar/Brincar/Descansar abrem o app já executando a ação, porque o
 * XP e os contadores vivem no Supabase, fora do alcance do widget.
 */
class CareWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CareWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val mood = WidgetStore.getMood(context)
      val views = RemoteViews(context.packageName, R.layout.widget_care)

      views.setImageViewResource(R.id.widget_care_pet, WidgetTheme.petDrawable(mood.emotion))
      views.setInt(R.id.widget_care_pet, "setBackgroundResource", WidgetTheme.tintBackground(mood.emotion))
      views.setTextViewText(R.id.widget_care_name, mood.petName)
      views.setTextViewText(R.id.widget_care_sub, mood.hunger)
      views.setTextViewText(R.id.widget_care_mood, "${mood.moodPct}%")
      views.setTextColor(R.id.widget_care_mood, WidgetTheme.accent(mood.emotion))

      views.setOnClickPendingIntent(R.id.widget_care_feed, WidgetIntents.openApp(context, 40, "care?action=feed"))
      views.setOnClickPendingIntent(R.id.widget_care_play, WidgetIntents.openApp(context, 41, "care?action=play"))
      views.setOnClickPendingIntent(R.id.widget_care_rest, WidgetIntents.openApp(context, 42, "care?action=rest"))
      views.setOnClickPendingIntent(R.id.widget_care_root, WidgetIntents.openApp(context, 43, "open?screen=home"))
      return views
    }
  }
}
