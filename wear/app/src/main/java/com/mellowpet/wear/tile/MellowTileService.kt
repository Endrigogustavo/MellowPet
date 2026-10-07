package com.mellowpet.wear.tile

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.sp
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
 * BLOCO DE ATALHOS do design: a um deslize do mostrador.
 *
 * Esta e a decima segunda tela do arquivo, e a unica que nao podia virar
 * pagina do app — um Tile por definicao vive fora dele.
 *
 * Le o cache local, nunca o Data Layer: um Tile e renderizado fora do app e
 * nao pode esperar rede, entao buscar aqui deixaria a faixa em branco sempre
 * que o celular demorasse.
 *
 * O design desenha quatro circulos de 82 px com icone e rotulo. ProtoLayout
 * nao e Compose e nao desenha path arbitrario, entao os icones viram texto —
 * um Tile e um atalho, e o nome diz mais que um simbolo generico.
 */
private const val RESOURCES_VERSION = "2"

private const val SURFACE = 0xFF1C1420.toInt()
private const val TEXT_HIGH = 0xFFFAF6F2.toInt()
private const val TEXT_LOW = 0xFF9B8AA6.toInt()

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

    val header = LayoutElementBuilders.Column.Builder()
      .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
      .addContent(text(emotion.label, 16f, emotion.color.toArgb(), bold = true))
      .addContent(
        text(
          if (state.checkedInToday) "registrado hoje" else "toque para registrar",
          11f,
          TEXT_LOW,
        )
      )
      .build()

    val row1 = LayoutElementBuilders.Row.Builder()
      .addContent(shortcut("Respirar", emotion.color.toArgb(), 0.26f))
      .addContent(LayoutElementBuilders.Spacer.Builder().setWidth(dp(8f)).build())
      .addContent(shortcut("Carinho", SURFACE, 1f))
      .build()

    val row2 = LayoutElementBuilders.Row.Builder()
      .addContent(shortcut("Foco", SURFACE, 1f))
      .addContent(LayoutElementBuilders.Spacer.Builder().setWidth(dp(8f)).build())
      .addContent(shortcut("Diário", SURFACE, 1f))
      .build()

    val root = LayoutElementBuilders.Column.Builder()
      .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
      .setModifiers(openApp())
      .addContent(header)
      .addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(10f)).build())
      .addContent(row1)
      .addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(8f)).build())
      .addContent(row2)
      .build()

    val tile = TileBuilders.Tile.Builder()
      .setResourcesVersion(RESOURCES_VERSION)
      // O Tile nao se atualiza sozinho ao chegar estado novo; o listener do
      // Data Layer chama requestUpdate. Este intervalo e a rede de seguranca.
      .setFreshnessIntervalMillis(30 * 60 * 1000L)
      .setTileTimeline(
        TimelineBuilders.Timeline.Builder()
          .addTimelineEntry(
            TimelineBuilders.TimelineEntry.Builder()
              .setLayout(LayoutElementBuilders.Layout.Builder().setRoot(root).build())
              .build()
          )
          .build()
      )
      .build()

    return Futures.immediateFuture(tile)
  }

  private fun openAppClick(): ModifiersBuilders.Clickable =
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

  private fun openApp(): ModifiersBuilders.Modifiers =
    ModifiersBuilders.Modifiers.Builder().setClickable(openAppClick()).build()

  private fun text(value: String, size: Float, color: Int, bold: Boolean = false) =
    LayoutElementBuilders.Text.Builder()
      .setText(value)
      .setFontStyle(
        LayoutElementBuilders.FontStyle.Builder()
          .setSize(sp(size))
          .setColor(argb(color))
          .apply { if (bold) setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD) }
          .build()
      )
      .build()

  /** Circulo de atalho. Todos abrem o app: o Tile nao executa a acao, leva a
   * ela — que e o que um atalho faz. */
  private fun shortcut(label: String, bg: Int, alpha: Float): LayoutElementBuilders.Box =
    LayoutElementBuilders.Box.Builder()
      .setWidth(dp(74f))
      .setHeight(dp(74f))
      .setModifiers(
        ModifiersBuilders.Modifiers.Builder()
          .setBackground(
            ModifiersBuilders.Background.Builder()
              .setColor(argb(bg.withAlpha(alpha)))
              .setCorner(ModifiersBuilders.Corner.Builder().setRadius(dp(37f)).build())
              .build()
          )
          .setClickable(openAppClick())
          .build()
      )
      .addContent(text(label, 12f, TEXT_HIGH, bold = true))
      .build()
}

private fun Int.withAlpha(alpha: Float): Int =
  (this and 0x00FFFFFF) or (((alpha.coerceIn(0f, 1f) * 255).toInt()) shl 24)

private fun androidx.compose.ui.graphics.Color.toArgb(): Int =
  android.graphics.Color.argb(
    (alpha * 255).toInt(),
    (red * 255).toInt(),
    (green * 255).toInt(),
    (blue * 255).toInt(),
  )
