package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.graphics.Color
import android.widget.RemoteViews

/**
 * Widget de tela inicial, somente leitura: mostra o último humor gravado
 * pelo app em SharedPreferences (ver MellowWidgetModule). Não roda câmera
 * nem processamento nenhum — widgets não têm acesso a isso, só reflete o
 * que o app já calculou enquanto estava aberto.
 */
class MellowMoodWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    updateAll(context, appWidgetManager, appWidgetIds)
  }

  companion object {
    fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val prefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
      val label = prefs.getString(WIDGET_PREF_LABEL, null) ?: "Sem leitura"
      val colorHex = prefs.getString(WIDGET_PREF_COLOR, null)
      val color = try {
        if (colorHex != null) Color.parseColor(colorHex) else Color.parseColor("#B2BEC3")
      } catch (_: IllegalArgumentException) {
        Color.parseColor("#B2BEC3")
      }

      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.widget_mellow_mood)
        views.setTextViewText(R.id.widget_mood_label, label)
        views.setInt(R.id.widget_mood_dot, "setColorFilter", color)
        manager.updateAppWidget(id, views)
      }
    }
  }
}
