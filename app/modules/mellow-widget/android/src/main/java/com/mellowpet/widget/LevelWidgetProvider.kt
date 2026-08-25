package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** NÍVEL · 2×1 — o vínculo com o Mellow em barra fina. */
class LevelWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, LevelWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_level)
      val mood = WidgetStore.getMood(context)
      views.setInt(R.id.widget_level_root, "setBackgroundResource", WidgetTheme.tint26(mood.emotion))
      views.setImageViewResource(R.id.widget_level_pet, WidgetTheme.petDrawable(mood.emotion))
      views.setTextViewText(R.id.widget_level_n, "Nível ${mood.level}")
      views.setTextViewText(R.id.widget_level_xp, "${mood.progress}/100")
      views.setProgressBar(R.id.widget_level_bar, 100, mood.progress, false)
      views.setOnClickPendingIntent(R.id.widget_level_root, WidgetIntents.openApp(context, 126, "open?screen=home"))
      return views
    }
  }
}
