package com.mellowpet.wear.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import com.mellowpet.wear.data.BLUSH
import com.mellowpet.wear.data.BROWS
import com.mellowpet.wear.data.EYES
import com.mellowpet.wear.data.Emotion
import com.mellowpet.wear.data.HEAD
import com.mellowpet.wear.data.LINE
import com.mellowpet.wear.data.MOUTH
import com.mellowpet.wear.data.MUZZLE
import com.mellowpet.wear.data.PET_BODY
import com.mellowpet.wear.data.WHISKERS

/**
 * O Mellow no pulso.
 *
 * Desenha as mesmas strings SVG do app do celular. `PathParser` entende a
 * sintaxe de path do SVG, entao nao ha redesenho a mao: o bichinho e
 * literalmente o mesmo arquivo de formas, so que rasterizado pelo Compose.
 *
 * O desenho vive num espaco 100x100 (o viewBox do design) e e escalado para o
 * tamanho pedido, igual ao `PetFace.tsx`.
 */

private const val VIEW = 100f

private fun path(d: String): Path = PathParser().parsePathString(d).toPath()

@Composable
fun PetFace(
  emotion: Emotion,
  size: Dp,
  modifier: Modifier = Modifier,
  /** Respiracao suave. Desligada no Tile e em preview, onde nada anima. */
  breathing: Boolean = true,
) {
  // Caches: parsear path a cada frame de animacao seria desperdicio puro.
  val head = remember { path(HEAD) }
  val muzzle = remember { path(MUZZLE) }
  val whiskers = remember { WHISKERS.map { path(it) } }
  val eyes = remember(emotion) { EYES[emotion]!!.let { path(it.first) to path(it.second) } }
  val brows = remember(emotion) {
    BROWS[emotion]!!.let { (l, r) -> if (l.isEmpty()) null else path(l) to path(r) }
  }
  val mouth = remember(emotion) { path(MOUTH[emotion]!!) }

  val breath by rememberInfiniteTransition(label = "breath").animateFloat(
    initialValue = 1f,
    targetValue = if (breathing) 1.035f else 1f,
    animationSpec = infiniteRepeatable(tween(2600), RepeatMode.Reverse),
    label = "breathScale",
  )

  Canvas(modifier = modifier.size(size)) {
    val k = this.size.minDimension / VIEW
    scale(breath, pivot = center) {
      scale(k, pivot = Offset.Zero) {
        drawPet(emotion, head, muzzle, whiskers, eyes, brows, mouth)
      }
    }
  }
}

private fun DrawScope.drawPet(
  emotion: Emotion,
  head: Path,
  muzzle: Path,
  whiskers: List<Path>,
  eyes: Pair<Path, Path>,
  brows: Pair<Path, Path>?,
  mouth: Path,
) {
  drawPath(head, PET_BODY)

  // Barriga e brilho: os mesmos valores do PetFace.tsx (bel 0.22, luz a 0.2).
  drawOval(
    color = Color.Black.copy(alpha = 0.22f * 0.35f),
    topLeft = Offset(20f, 53f),
    size = Size(60f, 38f),
  )
  drawOval(
    color = Color.White.copy(alpha = 0.2f),
    topLeft = Offset(30f, 21f),
    size = Size(16f, 10f),
  )

  drawPath(muzzle, PET_BODY.lighten(0.88f))

  drawCircle(BLUSH.copy(alpha = 0.55f), radius = 7f, center = Offset(20f, 60f))
  drawCircle(BLUSH.copy(alpha = 0.55f), radius = 7f, center = Offset(80f, 60f))

  val whiskerStroke = Stroke(width = 1.5f, cap = StrokeCap.Round)
  whiskers.forEach { drawPath(it, Color(0xFF6B6470).copy(alpha = 0.75f), style = whiskerStroke) }

  // `happy` usa arcos no lugar dos olhos redondos — mesma regra do app.
  if (emotion == Emotion.HAPPY) {
    val arc = Stroke(width = 4.4f, cap = StrokeCap.Round)
    drawPath(eyes.first, LINE, style = arc)
    drawPath(eyes.second, LINE, style = arc)
  } else {
    val r = when (emotion) {
      Emotion.SURPRISED -> 7.6f
      Emotion.FEARFUL -> 5.4f
      else -> 6.6f
    }
    val y = if (emotion == Emotion.SURPRISED) 51f else 52f
    val glintY = if (emotion == Emotion.SURPRISED) 48.4f else 49.6f
    drawCircle(LINE, radius = r, center = Offset(36f, y))
    drawCircle(LINE, radius = r, center = Offset(64f, y))
    drawCircle(Color.White, radius = 2.3f, center = Offset(38.3f, glintY))
    drawCircle(Color.White, radius = 2.3f, center = Offset(66.3f, glintY))
  }

  brows?.let { (l, r) ->
    val s = Stroke(width = 2.6f, cap = StrokeCap.Round)
    drawPath(l, LINE, style = s)
    drawPath(r, LINE, style = s)
  }

  drawOval(LINE, topLeft = Offset(45.4f, 60.2f), size = Size(9.2f, 7.6f))
  drawPath(
    mouth,
    LINE,
    style = Stroke(width = 2.6f, cap = StrokeCap.Round),
  )
}

/** Mesma mistura do `mix()` do tema do app: aproxima a cor do branco. */
private fun Color.lighten(amount: Float): Color = Color(
  red = red + (1f - red) * amount,
  green = green + (1f - green) * amount,
  blue = blue + (1f - blue) * amount,
  alpha = alpha,
)
