package com.mellowpet.wear.tile

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.mellowpet.wear.data.Emotion
import com.mellowpet.wear.sync.StateCache

/**
 * Tile: o estado do Mellow a um deslize do mostrador.
 *
 * Le o cache local, nunca o Data Layer: um Tile e renderizado fora do app e nao
 * pode esperar rede — buscar aqui deixaria o Tile em branco sempre que o
 * celular demorasse.
 *
 * Sem o bichinho desenhado, de proposito: Tile usa ProtoLayout, nao Compose, e
 * o PetFace depende do Canvas do Compose. Portar o desenho para imagem exigiria
 * rasterizar e versionar PNG por emocao — mais peso do que vale para uma faixa
 * que mostra duas linhas de texto. O bichinho fica no app.
 */
private const val RESOURCES_VERSION = "1"

class MellowTileService : TileService() {

  override fun onTileResourcesRequest(
    requestParams: RequestBuilders.ResourcesRequest,
  ): ListenableFuture<ResourceBuilders.Resources> = Futures.immediateFuture(
    ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build()
  )

  override fun onTileRequest(
    requestParams: RequestBuilders.TileRequest,
  ): ListenableFuture<TileBuilders.Tile> {
    val state = StateCache.read(this)
    val emotion = Emotion.fromKey(state.emotion)

    val openApp = ModifiersBuilders.Modifiers.Builder()
      .setClickable(
        ModifiersBuilders.Clickable.Builder()
          .setOnClick(
            ActionBuilders.LaunchAction.Builder()
              .setAndroidActivity(
                ActionBuilders.AndroidActivity.Builder()
                  .setPackageName(packageName)
                  .setClassName("com.mellowpet.wear.MainActivity")
                  .build()
              )
              .build()
          )
          .build()
      )
      .build()

    val column = LayoutElementBuilders.Column.Builder()
      .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
      .setModifiers(openApp)
      .addContent(
        LayoutElementBuilders.Text.Builder()
          .setText(emotion.label)
          .setFontStyle(
            LayoutElementBuilders.FontStyle.Builder()
              .setSize(sp(18f))
              .setColor(argb(emotion.color.toArgb()))
              .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
              .build()
          )
          .build()
      )
      .addContent(
        LayoutElementBuilders.Spacer.Builder().setHeight(dp(4f)).build()
      )
      .addContent(
        LayoutElementBuilders.Text.Builder()
          .setText(
            if (state.checkedInToday) {
              "Nível ${state.level} · registrado hoje"
            } else {
              "Toque para registrar"
            }
          )
          .setFontStyle(
            LayoutElementBuilders.FontStyle.Builder()
              .setSize(sp(12f))
              .setColor(argb(0xFFB0B0B8.toInt()))
              .build()
          )
          .build()
      )
      .build()

    val tile = TileBuilders.Tile.Builder()
      .setResourcesVersion(RESOURCES_VERSION)
      // O Tile nao se atualiza sozinho ao chegar estado novo; o listener do
      // Data Layer chama requestUpdate. Este intervalo e so a rede de seguranca.
      .setFreshnessIntervalMillis(30 * 60 * 1000L)
      .setTileTimeline(
        TimelineBuilders.Timeline.Builder()
          .addTimelineEntry(
            TimelineBuilders.TimelineEntry.Builder()
              .setLayout(
                LayoutElementBuilders.Layout.Builder().setRoot(column).build()
              )
              .build()
          )
          .build()
      )
      .build()

    return Futures.immediateFuture(tile)
  }
}

private fun sp(value: Float) = androidx.wear.protolayout.DimensionBuilders.sp(value)

private fun androidx.compose.ui.graphics.Color.toArgb(): Int =
  android.graphics.Color.argb(
    (alpha * 255).toInt(),
    (red * 255).toInt(),
    (green * 255).toInt(),
    (blue * 255).toInt(),
  )
