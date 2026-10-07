package com.mellowpet.wear.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text

/**
 * A moldura que o design repete em todas as telas: fundo AMOLED e um anel de
 * progresso rente a borda.
 *
 * As proporcoes vem do arquivo de design, que desenha num viewBox de 300 com
 * raio 141 e traco 6 — ou seja, raio = 47% da largura e traco = 2%. Guardadas
 * como fracao, e nao em dp, porque assim a mesma tela serve o Watch4 de 40 mm
 * e o de 44 mm sem numero magico por tamanho.
 */
private const val RING_RADIUS_RATIO = 141f / 300f
private const val RING_STROKE_RATIO = 6f / 300f

/** Traco de fundo do anel: rgba(250,246,242,.1) do design. */
private val RingTrack = Color(0xFFFAF6F2).copy(alpha = 0.1f)

/**
 * @param progress 0..1. O anel comeca as 12h e cresce no sentido horario —
 *   o `rotate(-90)` do design.
 */
@Composable
fun WatchRing(
  progress: Float,
  color: Color,
  modifier: Modifier = Modifier,
  /** Foco usa um anel mais grosso e mais interno (r=128, traco 14). */
  radiusRatio: Float = RING_RADIUS_RATIO,
  strokeRatio: Float = RING_STROKE_RATIO,
  animate: Boolean = true,
) {
  val shown by animateFloatAsState(
    targetValue = progress.coerceIn(0f, 1f),
    animationSpec = tween(if (animate) 700 else 0),
    label = "ring",
  )
  Canvas(modifier = modifier.fillMaxSize()) {
    val side = size.minDimension
    val r = side * radiusRatio
    val stroke = Stroke(width = side * strokeRatio, cap = StrokeCap.Round)
    val topLeft = Offset(center.x - r, center.y - r)
    val arcSize = Size(r * 2, r * 2)
    drawArc(RingTrack, 0f, 360f, false, topLeft, arcSize, style = Stroke(width = side * strokeRatio))
    drawArc(color, -90f, 360f * shown, false, topLeft, arcSize, style = stroke)
  }
}

/** Tela redonda com o anel e o conteudo centralizado. */
@Composable
fun WatchScreen(
  ringProgress: Float,
  ringColor: Color,
  modifier: Modifier = Modifier,
  ringRadiusRatio: Float = RING_RADIUS_RATIO,
  ringStrokeRatio: Float = RING_STROKE_RATIO,
  showRing: Boolean = true,
  content: @Composable () -> Unit,
) {
  Box(
    modifier = modifier.fillMaxSize().background(Mellow.Background),
    contentAlignment = Alignment.Center,
  ) {
    if (showRing) {
      WatchRing(ringProgress, ringColor, Modifier, ringRadiusRatio, ringStrokeRatio)
    }
    content()
  }
}

/**
 * Pilula de informacao do mostrador: um indicador colorido e um numero.
 * Fundo `surf` do design (#1C1420).
 */
@Composable
fun InfoPill(dotColor: Color, label: String, modifier: Modifier = Modifier) {
  Row(
    modifier = modifier
      .clip(RoundedCornerShape(999.dp))
      .background(Mellow.Surface)
      .padding(horizontal = d(10f), vertical = d(6f)),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.Center,
  ) {
    Box(Modifier.size(d(9f)).clip(CircleShape).background(dotColor))
    Spacer(Modifier.width(d(5f)))
    Text(label, fontSize = s(12f), fontWeight = FontWeight.Bold, color = Mellow.TextHigh)
  }
}
