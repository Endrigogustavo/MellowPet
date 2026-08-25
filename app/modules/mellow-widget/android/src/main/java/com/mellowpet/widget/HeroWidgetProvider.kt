package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** MELLOW · 4×4 — o bichinho grande, com estado, nível e vínculo. */
class HeroWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, HeroWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_hero)
      val mood = WidgetStore.getMood(context)
      views.setImageViewResource(R.id.widget_hero_pet, WidgetTheme.petDrawable(mood.emotion))
      views.setInt(R.id.widget_hero_root, "setBackgroundResource", WidgetTheme.tintBackground(mood.emotion))
      views.setTextViewText(R.id.widget_hero_label, mood.label)
      views.setTextViewText(R.id.widget_hero_variant, WidgetTheme.variant(mood.emotion))
      views.setTextViewText(R.id.widget_hero_level, "Nv ${mood.level}")
      views.setProgressBar(R.id.widget_hero_bar, 100, mood.progress, false)
      views.setTextViewText(R.id.widget_hero_bond, "${mood.progress}/100 de vínculo")
      views.setTextViewText(R.id.widget_hero_pets, "${mood.pets} carinhos")
      views.setOnClickPendingIntent(R.id.widget_hero_root, WidgetIntents.openApp(context, 100, "open?screen=home"))
      return views
    }
  }
}
