package com.mellowpet.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/** MELLOW · 4×4 — o bichinho grande, com estado, nível e vínculo. */
class HeroWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, buildViews(context))
  }

  companion object {
    private val PET_IDS = intArrayOf(
      R.id.widget_hero_pet_anim_0, R.id.widget_hero_pet_anim_1, R.id.widget_hero_pet_anim_2,
      R.id.widget_hero_pet_anim_3, R.id.widget_hero_pet_anim_4, R.id.widget_hero_pet_anim_5,
      R.id.widget_hero_pet_anim_6, R.id.widget_hero_pet_anim_7, R.id.widget_hero_pet_anim_8,
      R.id.widget_hero_pet_anim_9,
    )
    private val HALO_IDS = intArrayOf(
      R.id.widget_hero_halo_anim_0, R.id.widget_hero_halo_anim_1, R.id.widget_hero_halo_anim_2,
      R.id.widget_hero_halo_anim_3, R.id.widget_hero_halo_anim_4, R.id.widget_hero_halo_anim_5,
      R.id.widget_hero_halo_anim_6, R.id.widget_hero_halo_anim_7, R.id.widget_hero_halo_anim_8,
      R.id.widget_hero_halo_anim_9,
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
      val ids = manager.getAppWidgetIds(ComponentName(context, HeroWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_hero)
      val mood = WidgetStore.getMood(context)
      // Efeitos do design: neon radial no fundo, halo pulsando e o bichinho
      // flutuando — todos AnimationDrawable/gradient, que RemoteViews aceita.
      setFrames(views, PET_IDS, WidgetTheme.floatFrames(mood.emotion))
      setFrames(views, HALO_IDS, WidgetTheme.haloFrames(mood.emotion))
      views.setInt(R.id.widget_hero_root, "setBackgroundResource", WidgetTheme.glowBackground(mood.emotion))
      views.setTextViewText(R.id.widget_hero_label, mood.label)
      views.setTextViewText(R.id.widget_hero_variant, WidgetTheme.variant(mood.emotion))
      views.setTextViewText(R.id.widget_hero_level, "Nv ${mood.level}")
      views.setProgressBar(R.id.widget_hero_bar, 100, mood.progress, false)
      views.setTextViewText(R.id.widget_hero_bond, "${mood.progress}/100 de vínculo")
      views.setTextViewText(R.id.widget_hero_pets, "${mood.pets} carinhos")
      views.setOnClickPendingIntent(R.id.widget_hero_root, WidgetIntents.openApp(context, 100, "open?screen=home"))
      return views
    }
  }
}
