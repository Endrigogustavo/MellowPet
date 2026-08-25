package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/**
 * HUMOR · 2×2 — o Mellow desenhado sobre o fundo tingido pela emoção.
 * Somente leitura: widgets não têm acesso à câmera nem ao pipeline de visão,
 * só refletem o que o app já calculou (ver WidgetStore).
 */
class MellowMoodWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, MellowMoodWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val mood = WidgetStore.getMood(context)
      val views = RemoteViews(context.packageName, R.layout.widget_mood)
      views.setInt(R.id.widget_mood_root, "setBackgroundResource", WidgetTheme.tintBackground(mood.emotion))
      views.setImageViewResource(R.id.widget_mood_pet, WidgetTheme.petDrawable(mood.emotion))
      views.setTextViewText(R.id.widget_mood_label, mood.label)
      views.setTextViewText(R.id.widget_mood_sub, "Nível ${mood.level} · ${mood.progress}/100")
      views.setOnClickPendingIntent(R.id.widget_mood_root, WidgetIntents.openApp(context, 1, "open?screen=home"))
      return views
    }
  }
}
