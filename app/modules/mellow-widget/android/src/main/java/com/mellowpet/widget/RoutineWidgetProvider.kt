package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** ROTINA · 4×2 — até três itens do dia com horário, ponto de estado e
 * rótulo (feito / agora / a fazer), como no design. */
class RoutineWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    private val ROWS = intArrayOf(R.id.widget_routine_row1, R.id.widget_routine_row2, R.id.widget_routine_row3)
    private val TIMES = intArrayOf(R.id.widget_routine_time1, R.id.widget_routine_time2, R.id.widget_routine_time3)
    private val DOTS = intArrayOf(R.id.widget_routine_dot1, R.id.widget_routine_dot2, R.id.widget_routine_dot3)
    private val NAMES = intArrayOf(R.id.widget_routine_name1, R.id.widget_routine_name2, R.id.widget_routine_name3)
    private val STATES = intArrayOf(R.id.widget_routine_state1, R.id.widget_routine_state2, R.id.widget_routine_state3)

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, RoutineWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun dotFor(state: String) = when (state) {
      "done" -> R.drawable.widget_dot_done
      "now" -> R.drawable.widget_dot_now
      else -> R.drawable.widget_dot_todo
    }

    private fun labelFor(state: String) = when (state) {
      "done" -> "FEITO"
      "now" -> "AGORA"
      else -> "A FAZER"
    }

    private fun colorFor(state: String) = when (state) {
      "done" -> 0xFF10B981.toInt()
      "now" -> 0xFFF59E0B.toInt()
      else -> 0xFF9CA3AF.toInt()
    }

    private fun buildViews(context: Context): RemoteViews {
      val items = WidgetStore.getRoutine(context)
      val views = RemoteViews(context.packageName, R.layout.widget_routine)

      val now = items.firstOrNull { it.state == "now" }
      views.setTextViewText(R.id.widget_routine_now, if (now != null) "agora: ${now.name}" else "")

      for (i in 0..2) {
        val item = items.getOrNull(i)
        if (item == null) {
          // Some a linha inteira em vez de deixar um espaço vazio com traços.
          views.setViewVisibility(ROWS[i], if (i == 0 && items.isEmpty()) View.VISIBLE else View.GONE)
          if (i == 0 && items.isEmpty()) {
            views.setTextViewText(TIMES[0], "--:--")
            views.setTextViewText(NAMES[0], "Nada agendado ainda")
            views.setTextViewText(STATES[0], "")
            views.setImageViewResource(DOTS[0], R.drawable.widget_dot_todo)
          }
          continue
        }
        views.setViewVisibility(ROWS[i], View.VISIBLE)
        views.setTextViewText(TIMES[i], item.time)
        views.setTextViewText(NAMES[i], item.name)
        views.setTextViewText(STATES[i], labelFor(item.state))
        views.setTextColor(STATES[i], colorFor(item.state))
        views.setImageViewResource(DOTS[i], dotFor(item.state))
      }

      views.setOnClickPendingIntent(R.id.widget_routine_root, WidgetIntents.openApp(context, 20, "open?screen=routine"))
      return views
    }
  }
}
