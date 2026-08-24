package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.mellowpet.widgetbridge.R

/** Registro rápido de sentimento sem precisar abrir o app pra navegar até
 * lá — cada emoji já é o valor final, o MellowPet só confirma o registro
 * quando abre pelo deep link. Não depende de dado nenhum vindo do app, por
 * isso não tem `updateAll`: o layout é sempre o mesmo. */
class QuickMoodWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val views = RemoteViews(context.packageName, R.layout.widget_quick_mood)
    val moods = listOf(
      R.id.widget_qm_happy to "happy",
      R.id.widget_qm_sad to "sad",
      R.id.widget_qm_angry to "angry",
      R.id.widget_qm_fearful to "fearful",
      R.id.widget_qm_surprised to "surprised",
    )
    moods.forEachIndexed { i, (viewId, value) ->
      views.setOnClickPendingIntent(viewId, WidgetIntents.openApp(context, 30 + i, "mood?value=$value"))
    }
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, views)
  }
}
