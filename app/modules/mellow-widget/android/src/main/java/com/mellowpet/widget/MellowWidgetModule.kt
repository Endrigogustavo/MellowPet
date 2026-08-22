package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

const val WIDGET_PREFS_NAME = "mellow_widget_prefs"
const val WIDGET_PREF_LABEL = "mood_label"
const val WIDGET_PREF_COLOR = "mood_color"

class MellowWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MellowWidget")

    AsyncFunction("updateMoodAsync") { label: String, colorHex: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(WIDGET_PREF_LABEL, label)
        .putString(WIDGET_PREF_COLOR, colorHex)
        .apply()

      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        android.content.ComponentName(context, MellowMoodWidgetProvider::class.java)
      )
      if (ids.isNotEmpty()) {
        MellowMoodWidgetProvider.updateAll(context, manager, ids)
      }
    }
  }
}
