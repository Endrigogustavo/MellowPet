package com.mellowpet.wear.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

/**
 * Paleta do MellowPet no relogio.
 *
 * Vem do tema ESCURO do app (theme/palette.ts, `DARK`), nao do claro: a tela do
 * Watch 4 e OLED, onde preto puro nao acende pixel nenhum. Fundo claro aqui
 * seria mais feio e mais caro em bateria.
 *
 * O fundo e #000 em vez do `page` (#1B1120) do celular justamente por isso — no
 * OLED o preto real desaparece na moldura redonda, e o mostrador inteiro vira
 * o cartao.
 */
object Mellow {
  val Primary = Color(0xFFC6A9F0)
  val PrimaryDim = Color(0xFF4A3550)
  /** `surf` do design do relogio (#1C1420) — mais fundo que o do celular,
   * para o cartao nao brilhar sobre o preto do AMOLED. */
  val Surface = Color(0xFF1C1420)
  val Background = Color(0xFF000000)

  /** Faixas de estresse do design. */
  val StressHigh = Color(0xFFFF7675)
  val StressMid = Color(0xFFF59E0B)
  val StressLow = Color(0xFF10B981)

  val TextHigh = Color(0xFFFAF6F2)
  val TextMid = Color(0xFFC7B4D0)
  val TextLow = Color(0xFF9B8AA6)

  /** Cores originais do bichinho, como no arquivo de design: a foca cinza
   * (#A8B0B4) com traco quase preto. Nao e o tom creme do tema escuro do
   * celular — o design do relogio mantem o pet na cor dele. */
  val SealBody = Color(0xFFA8B0B4)
  val SealBelly = Color(0xFF99A0A4)
  val SealLine = Color(0xFF2E2A33)
  val SealWhisker = Color(0xFF6B6470)
  val Blush = Color(0xFFF0A0AC)
}

private val WearColors = Colors(
  primary = Mellow.Primary,
  primaryVariant = Mellow.PrimaryDim,
  onPrimary = Mellow.PrimaryDim,
  secondary = Mellow.Surface,
  secondaryVariant = Mellow.Surface,
  onSecondary = Mellow.TextHigh,
  surface = Mellow.Surface,
  onSurface = Mellow.TextHigh,
  onSurfaceVariant = Mellow.TextLow,
  background = Mellow.Background,
  onBackground = Mellow.TextHigh,
  error = Color(0xFFEF4444),
  onError = Color(0xFF1B1120),
)

@Composable
fun MellowTheme(content: @Composable () -> Unit) {
  MaterialTheme(colors = WearColors, content = content)
}
