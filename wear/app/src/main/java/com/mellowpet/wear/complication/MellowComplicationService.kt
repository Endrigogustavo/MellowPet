package com.mellowpet.wear.complication

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.mellowpet.wear.MainActivity
import com.mellowpet.wear.data.Emotion
import com.mellowpet.wear.sync.StateCache

/**
 * Complicação para o mostrador: a emoção do momento e o nível do pet, num
 * espaço pequeno. Toque abre o app do relógio. Lê do mesmo cache do Tile, então
 * funciona sem rede e mostra o último valor conhecido.
 */
class MellowComplicationService : SuspendingComplicationDataSourceService() {

  override fun getPreviewData(type: ComplicationType): ComplicationData? =
    if (type == ComplicationType.SHORT_TEXT) build(Emotion.fromKey("happy").label, 3, null) else null

  override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
    if (request.complicationType != ComplicationType.SHORT_TEXT) return null
    val state = StateCache.read(this)
    val tap = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    return build(Emotion.fromKey(state.emotion).label, state.level, tap)
  }

  private fun build(label: String, level: Int, tap: PendingIntent?): ComplicationData =
    ShortTextComplicationData.Builder(
      text = PlainComplicationText.Builder(label.take(7)).build(),
      contentDescription = PlainComplicationText.Builder("Mellow: $label, nível $level").build(),
    )
      .setTitle(PlainComplicationText.Builder("Nv $level").build())
      .setTapAction(tap)
      .build()

  companion object {
    /** Pede ao mostrador para reler a complicação (estado novo do celular). */
    fun requestUpdate(context: Context) {
      ComplicationDataSourceUpdateRequester
        .create(context, ComponentName(context, MellowComplicationService::class.java))
        .requestUpdateAll()
    }
  }
}
