package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * COMO VOCÊ ESTÁ? · 4×2 — as seis carinhas do design. Cada emoji já é o
 * valor final; o MellowPet só registra quando abre pelo deep link. Não
 * depende de dado nenhum vindo do app, por isso não tem `updateAll`.
 */
class QuickMoodWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val views = RemoteViews(context.packageName, R.layout.widget_quick_mood)
    val moods = listOf(
      R.id.widget_qm_neutral to "neutral",
      R.id.widget_qm_happy to "happy",
      R.id.widget_qm_anxious to "fearful",
      R.id.widget_qm_sad to "sad",
      R.id.widget_qm_surprised to "surprised",
      R.id.widget_qm_angry to "angry",
    )
    moods.forEachIndexed { i, (viewId, value) ->
      views.setOnClickPendingIntent(viewId, WidgetIntents.openApp(context, 30 + i, "mood?value=$value"))
    }
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, views)
  }
}
