package com.mellowpet.wear.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.scale as drawScale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Text
import com.mellowpet.wear.data.Emotion
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * O indicador de pagina do Scaffold ocupa a base da tela. Sem reservar esse
 * espaco o conteudo encosta nele — foi o que cortou o bichinho do mostrador.
 */
val INDICATOR_SPACE = 16.dp

/* ── mostrador ──────────────────────────────────────────────────────────── */

/**
 * MOSTRADOR do design: anel = bem-estar do dia, hora grande, duas pilulas
 * (batimento e emocao) e o bichinho, tocavel.
 *
 * Nao e um watch face de verdade — aqueles sao outro tipo de servico, com
 * regras proprias de consumo. E a tela inicial do app com a mesma cara.
 */
@Composable
fun DialScreen(
  emotion: Emotion,
  wellbeing: Float,
  dateLabel: String,
  timeLabel: String,
  bpm: Int?,
  onPet: () -> Unit,
) {
  WatchScreen(ringProgress = wellbeing, ringColor = emotion.color) {
    Column(
      modifier = Modifier.fillMaxSize().padding(bottom = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Text(
        text = dateLabel.uppercase(),
        fontSize = s(12f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextMid,
      )
      Text(
        text = timeLabel,
        fontSize = s(62f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
      )
      Spacer(Modifier.height(d(10f)))
      Row(horizontalArrangement = Arrangement.spacedBy(d(9f))) {
        InfoPill(Mellow.StressHigh, bpm?.toString() ?: "–")
        InfoPill(emotion.color, emotion.label)
      }
      Spacer(Modifier.height(d(6f)))
      Box(modifier = Modifier.clickable(onClick = onPet)) {
        PetFace(emotion = emotion, size = d(62f))
      }
    }
  }
}

/* ── humor ──────────────────────────────────────────────────────────────── */

/** HUMOR: anel = precisao da leitura, bichinho grande, rotulo e contagem. */
@Composable
fun MoodScreen(emotion: Emotion, confidence: Float, pets: Int, onPet: () -> Unit) {
  WatchScreen(ringProgress = confidence, ringColor = emotion.color) {
    Column(
      modifier = Modifier.fillMaxSize().padding(bottom = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Text(
        text = "O MELLOW SENTE",
        fontSize = s(11f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextMid,
      )
      // Tela cheia: o bichinho ocupa a largura do circulo, nao um medalhao
      // no meio dela.
      Box(modifier = Modifier.clickable(onClick = onPet)) {
        PetFace(emotion = emotion, size = d(172f))
      }
      Text(
        text = emotion.label,
        fontSize = s(24f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
      )
      Text(
        text = "${(confidence * 100).roundToInt()}% · $pets ${if (pets == 1) "carinho" else "carinhos"}",
        fontSize = s(12f),
        color = Mellow.TextMid,
      )
    }
  }
}

/* ── check-in ───────────────────────────────────────────────────────────── */

/**
 * CHECK-IN: as carinhas em volta do circulo, no raio que o design define.
 *
 * O design mostra seis; aqui sao as sete emocoes que o app realmente registra.
 * Tirar uma para o desenho fechar em 60 graus deixaria o relogio incapaz de
 * anotar algo que o celular anota, e furaria a estatistica do mapa emocional.
 */
@Composable
fun CheckinScreen(
  current: Emotion,
  chosen: Emotion?,
  bpm: Int?,
  onPick: (Emotion) -> Unit,
) {
  val emotions = Emotion.entries
  val step = 360f / emotions.size
  val radius = d(100f)
  val face = d(52f)

  WatchScreen(ringProgress = 0f, ringColor = current.color, showRing = false) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
      emotions.forEachIndexed { i, e ->
        val angle = Math.toRadians((-90f + i * step).toDouble())
        val selected = chosen == e
        Box(
          modifier = Modifier
            .offset(x = radius * cos(angle).toFloat(), y = radius * sin(angle).toFloat())
            .size(face)
            .clip(CircleShape)
            .background(if (selected) e.color.copy(alpha = 0.3f) else Mellow.Surface)
            .border(
              width = if (selected) 1.5.dp else 0.dp,
              color = if (selected) e.color else Color.Transparent,
              shape = CircleShape,
            )
            .clickable { onPick(e) },
          contentAlignment = Alignment.Center,
        ) {
          PetFace(emotion = e, size = face * 0.72f, breathing = false)
        }
      }

      Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(d(118f)),
      ) {
        Text(
          text = "COMO VOCÊ ESTÁ?",
          fontSize = s(10f),
          fontWeight = FontWeight.Bold,
          color = Mellow.TextLow,
          textAlign = TextAlign.Center,
        )
        Text(
          text = (chosen ?: current).label,
          fontSize = s(19f),
          fontWeight = FontWeight.Bold,
          color = Mellow.TextHigh,
          textAlign = TextAlign.Center,
        )
        Text(
          text = when {
            chosen != null -> "anotado no diário"
            bpm != null -> "$bpm bpm"
            else -> "leitura atual"
          },
          fontSize = s(11f),
          color = Mellow.TextMid,
          textAlign = TextAlign.Center,
        )
      }
    }
  }
}

/* ── respiração ─────────────────────────────────────────────────────────── */

/** Fases do design: 4 s cada, ciclo de 12 s, cinco ciclos. */
enum class BreathPhase(val label: String) { INHALE("Inspire"), HOLD("Segure"), EXHALE("Solte") }

const val BREATH_PHASE_SECONDS = 4
const val BREATH_CYCLES = 5

@Composable
fun BreatheScreen(
  running: Boolean,
  elapsedSeconds: Int,
  color: Color,
  onToggle: () -> Unit,
) {
  val cycleSecond = elapsedSeconds % (BREATH_PHASE_SECONDS * 3)
  val phase = BreathPhase.entries[cycleSecond / BREATH_PHASE_SECONDS]
  val cycle = (elapsedSeconds / (BREATH_PHASE_SECONDS * 3)) + 1

  // O design encolhe no "solte" e infla nas outras duas fases.
  val target = if (!running) 0.9f else if (phase == BreathPhase.EXHALE) 0.72f else 1.26f
  val scale by animateFloatAsState(
    targetValue = target,
    animationSpec = tween(if (running) BREATH_PHASE_SECONDS * 1000 else 800),
    label = "blob",
  )

  val total = BREATH_PHASE_SECONDS * 3 * BREATH_CYCLES
  WatchScreen(
    ringProgress = if (running) elapsedSeconds.toFloat() / total else 0f,
    ringColor = color,
  ) {
    Box(
      modifier = Modifier.fillMaxSize().clickable(onClick = onToggle),
      contentAlignment = Alignment.Center,
    ) {
      Box(
        modifier = Modifier
          .size(d(140f))
          .scale(scale)
          .clip(CircleShape)
          .background(color),
      )
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
          text = if (running) phase.label else "Respirar",
          fontSize = s(24f),
          fontWeight = FontWeight.Bold,
          // Tinta escura do design (#2A1B31): o balao e claro, e texto claro
          // sobre ele sumiria.
          color = Color(0xFF2A1B31),
        )
        Text(
          text = if (running) {
            "ciclo ${minOf(BREATH_CYCLES, cycle)} de $BREATH_CYCLES"
          } else {
            "toque para começar"
          },
          fontSize = s(12f),
          fontWeight = FontWeight.Bold,
          color = Color(0xFF2A1B31).copy(alpha = 0.72f),
        )
      }
    }
  }
}

/* ── batimento ──────────────────────────────────────────────────────────── */

/**
 * BATIMENTO: numero grande, grafico das ultimas leituras e uma faixa.
 *
 * O design deriva o "estresse" de uma tabela por emocao. Aqui a faixa vem do
 * batimento medido, nao da emocao: inventar um indice a partir do que a pessoa
 * declarou seria apresentar palpite como medicao. Ainda assim batimento alto
 * nao e estresse — pode ser escada ou cafe — e o rotulo fala de batimento.
 */
@Composable
fun HeartScreen(bpm: Int?, history: List<Int>, granted: Boolean, onAsk: () -> Unit) {
  val band = bpm?.let { stressBand(it) }
  val color = band?.color ?: Mellow.TextLow
  // Faixa util do anel: 50 a 120 bpm cobre repouso ate esforco leve.
  val progress = bpm?.let { ((it - 50f) / 70f).coerceIn(0f, 1f) } ?: 0f

  WatchScreen(ringProgress = progress, ringColor = color) {
    Column(
      modifier = Modifier.padding(bottom = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      val pulse = if (bpm != null) {
        val transition = rememberInfiniteTransition(label = "beat")
        val animated by transition.animateFloat(
          initialValue = 1f,
          targetValue = 1.18f,
          animationSpec = infiniteRepeatable(tween(1100), RepeatMode.Reverse),
          label = "beatScale",
        )
        animated
      } else {
        1f
      }
      Heart(Modifier.size(d(28f)).scale(pulse))
      Row(verticalAlignment = Alignment.Bottom) {
        Text(
          text = bpm?.toString() ?: "–",
          fontSize = s(56f),
          fontWeight = FontWeight.Bold,
          color = Mellow.TextHigh,
        )
        Spacer(Modifier.width(d(4f)))
        Text("bpm", fontSize = s(13f), fontWeight = FontWeight.Bold, color = Mellow.TextMid)
      }
      if (history.size > 1) {
        Sparkline(history, Modifier.width(d(150f)).height(d(32f)))
      }
      Spacer(Modifier.height(d(8f)))
      if (!granted) {
        Pill(Mellow.Primary, "Permitir sensor", Mellow.PrimaryDim, Modifier.clickable(onClick = onAsk))
      } else if (band != null) {
        Pill(band.color.copy(alpha = 0.16f), band.label, band.color)
      } else {
        Text("medindo…", fontSize = s(12f), color = Mellow.TextLow)
      }
    }
  }
}

@Composable
private fun Pill(bg: Color, label: String, ink: Color, modifier: Modifier = Modifier) {
  Box(
    modifier = modifier
      .clip(RoundedCornerShape(999.dp))
      .background(bg)
      .padding(horizontal = d(13f), vertical = d(6f)),
  ) {
    Text(label, fontSize = s(12f), fontWeight = FontWeight.Bold, color = ink)
  }
}

data class StressBand(val label: String, val color: Color)

/** Faixas pelo batimento medido. Os limites seguem as cores do design. */
fun stressBand(bpm: Int): StressBand = when {
  bpm >= 100 -> StressBand("Batimento alto", Mellow.StressHigh)
  bpm >= 85 -> StressBand("Acelerado", Mellow.StressMid)
  else -> StressBand("Calmo", Mellow.StressLow)
}

@Composable
private fun Heart(modifier: Modifier = Modifier) {
  val path = remember {
    PathParser()
      .parsePathString("M12 21s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.4-7 10-7 10z")
      .toPath()
  }
  Canvas(modifier) {
    drawScale(size.minDimension / 24f, pivot = Offset.Zero) {
      drawPath(path, Mellow.StressHigh)
    }
  }
}

@Composable
private fun Sparkline(values: List<Int>, modifier: Modifier = Modifier) {
  Canvas(modifier) {
    val min = values.min().toFloat()
    val max = values.max().toFloat()
    val span = (max - min).takeIf { it > 0f } ?: 1f
    val dx = size.width / (values.size - 1).coerceAtLeast(1)
    var prev: Offset? = null
    values.forEachIndexed { i, v ->
      val point = Offset(i * dx, size.height - ((v - min) / span) * size.height)
      prev?.let { drawLine(Mellow.StressHigh, it, point, strokeWidth = 2.2f, cap = StrokeCap.Round) }
      prev = point
    }
  }
}

/* ── foco ───────────────────────────────────────────────────────────────── */

const val FOCUS_SECONDS = 25 * 60

/**
 * FOCO: so o cronometro. O design diz "notificacoes silenciadas", mas silenciar
 * de verdade exige a permissao de Nao Perturbe, que e um pedido grande para o
 * que entrega — fica para quando alguem precisar.
 */
@Composable
fun FocusScreen(running: Boolean, remaining: Int, onToggle: () -> Unit) {
  val mm = (remaining / 60).toString().padStart(2, '0')
  val ss = (remaining % 60).toString().padStart(2, '0')
  WatchScreen(
    ringProgress = 1f - remaining.toFloat() / FOCUS_SECONDS,
    ringColor = Mellow.Primary,
    // Anel mais grosso e mais interno, como no design (r=128, traco 14).
    ringRadiusRatio = 128f / 300f,
    ringStrokeRatio = 14f / 300f,
  ) {
    Column(
      modifier = Modifier.fillMaxSize().clickable(onClick = onToggle).padding(bottom = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Text(
        text = "MODO FOCO",
        fontSize = s(11f),
        fontWeight = FontWeight.Bold,
        color = Mellow.Primary,
      )
      Text(
        text = "$mm:$ss",
        fontSize = s(54f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
      )
      Text(
        text = if (running) "toque para parar" else "toque para começar",
        fontSize = s(12f),
        color = Mellow.TextMid,
      )
    }
  }
}
