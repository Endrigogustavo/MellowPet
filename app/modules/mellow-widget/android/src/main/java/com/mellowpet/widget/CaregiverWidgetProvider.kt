package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** CUIDADOR · 4×2 — quem você acompanha e o bem-estar de cada um. */
class CaregiverWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CaregiverWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_caregiver)
      val people = WidgetStore.getPeople(context)
      val names = intArrayOf(R.id.widget_cg_name0, R.id.widget_cg_name1)
      val states = intArrayOf(R.id.widget_cg_state0, R.id.widget_cg_state1)
      val wbs = intArrayOf(R.id.widget_cg_wb0, R.id.widget_cg_wb1)
      val cells = intArrayOf(R.id.widget_cg_name0, R.id.widget_cg_name1)
      for (i in 0..1) {
        val p = people.getOrNull(i)
        views.setTextViewText(names[i], p?.name ?: "—")
        views.setTextViewText(states[i], p?.state ?: "sem vínculo")
        views.setTextViewText(wbs[i], p?.let { "${it.wellbeing}" } ?: "--")
        views.setViewVisibility(cells[i], View.VISIBLE)
      }
      views.setTextViewText(R.id.widget_cg_status, if (people.isEmpty()) "sem vínculo" else "conectado")
      views.setTextViewText(R.id.widget_cg_alert, WidgetStore.getCareAlert(context) ?: "")
      views.setOnClickPendingIntent(R.id.widget_caregiver_root, WidgetIntents.openApp(context, 102, "open?screen=care"))
      return views
    }
  }
}
