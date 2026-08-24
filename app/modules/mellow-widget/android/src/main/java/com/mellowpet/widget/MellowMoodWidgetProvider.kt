package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/**
 * Widget de tela inicial, somente leitura: mostra o último humor e nível
 * gravados pelo app (ver WidgetStore). Não roda câmera nem processamento
 * nenhum — widgets não têm acesso a isso, só refletem o que o app já
 * calculou enquanto estava aberto. Toque abre o app na Home.
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
      views.setTextViewText(R.id.widget_mood_emoji, mood.emoji)
      views.setTextViewText(R.id.widget_mood_label, mood.label)
      views.setTextViewText(R.id.widget_mood_level, "Nv ${mood.level}")
      views.setProgressBar(R.id.widget_mood_bar, 100, mood.progress, false)
      views.setTextViewText(R.id.widget_mood_sub, "${mood.progress}/100 para o próximo nível")
      views.setOnClickPendingIntent(R.id.widget_mood_root, WidgetIntents.openApp(context, 1, "open?screen=home"))
      return views
    }
  }
}
