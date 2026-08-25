package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** FRASE DO DIA · 4×2 — a frase que combina com o estado de agora. */
class QuoteWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, QuoteWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_quote)
      val mood = WidgetStore.getMood(context)
      views.setInt(R.id.widget_quote_root, "setBackgroundResource", WidgetTheme.glowBackground(mood.emotion))
      views.setTextViewText(R.id.widget_quote_text, WidgetTheme.quote(mood.emotion))
      views.setOnClickPendingIntent(R.id.widget_quote_root, WidgetIntents.openApp(context, 103, "open?screen=home"))
      return views
    }
  }
}
