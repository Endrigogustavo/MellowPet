package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/**
 * HUMOR · 2×2 — o Mellow desenhado sobre o fundo tingido pela emoção.
 * Somente leitura: widgets não têm acesso à câmera nem ao pipeline de visão,
 * só refletem o que o app já calculou (ver WidgetStore).
 */
class MellowMoodWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    private val PET_IDS = intArrayOf(
      R.id.widget_mood_pet_anim_0, R.id.widget_mood_pet_anim_1, R.id.widget_mood_pet_anim_2,
      R.id.widget_mood_pet_anim_3, R.id.widget_mood_pet_anim_4, R.id.widget_mood_pet_anim_5,
      R.id.widget_mood_pet_anim_6, R.id.widget_mood_pet_anim_7, R.id.widget_mood_pet_anim_8,
      R.id.widget_mood_pet_anim_9,
    )

  /** Aponta cada quadro do ViewFlipper para o frame da emoção atual.
   * O layout nasce com os frames de "neutral"; isto os troca em runtime. */
  private fun setFrames(
    views: RemoteViews,
    ids: IntArray,
    frames: IntArray,
  ) {
    ids.forEachIndexed { i, id -> views.setImageViewResource(id, frames[i]) }
  }

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, MellowMoodWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val mood = WidgetStore.getMood(context)
      val views = RemoteViews(context.packageName, R.layout.widget_mood)
      views.setInt(R.id.widget_mood_root, "setBackgroundResource", WidgetTheme.glowBackground(mood.emotion))
      setFrames(views, PET_IDS, WidgetTheme.floatFrames(mood.emotion))
      views.setTextViewText(R.id.widget_mood_label, mood.label)
      views.setTextViewText(R.id.widget_mood_sub, "Nível ${mood.level} · ${mood.progress}/100")
      views.setOnClickPendingIntent(R.id.widget_mood_root, WidgetIntents.openApp(context, 1, "open?screen=home"))
      return views
    }
  }
}
