package com.mellowpet.wear.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.scale as drawScale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Text
import com.mellowpet.wear.data.Emotion

/* ── música ─────────────────────────────────────────────────────────────── */

/** O que o celular diz estar tocando. Null em tudo = nada chegou ainda. */
data class NowPlaying(
  val track: String?,
  val playlist: String?,
  val playing: Boolean,
  val color: Color,
)

/**
 * MÚSICA do design: equalizador, faixa, playlist e os tres controles.
 *
 * O relogio nao toca nada — quem tem a sessao do Spotify e o celular. Daqui
 * saem comandos e chega o estado, pelo mesmo Data Layer do check-in. Com o
 * celular fora de alcance os botoes nao teriam efeito, e a tela diz isso em
 * vez de fingir que mandou.
 */
@Composable
fun MusicScreen(
  np: NowPlaying,
  reachable: Boolean,
  onPrev: () -> Unit,
  onToggle: () -> Unit,
  onNext: () -> Unit,
) {
  val color = np.color
  WatchScreen(ringProgress = 0f, ringColor = color, showRing = false) {
    // Brilho da cor da playlist, como o `plGlow` do design.
    Box(
      modifier = Modifier.fillMaxSize().background(
        Brush.radialGradient(
          colors = listOf(color.copy(alpha = 0.34f), Color.Transparent),
          radius = 420f,
        )
      )
    )
    Column(
      modifier = Modifier.padding(horizontal = d(46f), vertical = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Equalizer(playing = np.playing && reachable, color = color)
      Spacer(Modifier.height(d(8f)))
      Text(
        text = "SPOTIFY",
        fontSize = s(10f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextLow,
      )
      Text(
        text = np.track ?: "Nada tocando",
        fontSize = s(19f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
        textAlign = TextAlign.Center,
        maxLines = 2,
      )
      Text(
        text = when {
          !reachable -> "sem o celular por perto"
          np.playlist != null -> np.playlist
          else -> "abra uma playlist no celular"
        },
        fontSize = s(12f),
        color = Mellow.TextMid,
        textAlign = TextAlign.Center,
        maxLines = 1,
      )
      Spacer(Modifier.height(d(14f)))
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(d(14f)),
      ) {
        RoundIcon(SKIP_PREV, d(42f), Mellow.Surface, Mellow.TextHigh, reachable, onPrev)
        RoundIcon(
          if (np.playing) PAUSE else PLAY,
          d(60f),
          color,
          Color.White,
          reachable,
          onToggle,
        )
        RoundIcon(SKIP_NEXT, d(42f), Mellow.Surface, Mellow.TextHigh, reachable, onNext)
      }
    }
  }
}

private const val SKIP_PREV = "M18 6v12l-9-6zM7 6h2v12H7z"
private const val SKIP_NEXT = "M6 6v12l9-6zM15 6h2v12h-2z"
private const val PLAY = "M8 5.5l10 6.5-10 6.5z"
private const val PAUSE = "M9 6v12M15 6v12"

@Composable
private fun RoundIcon(
  pathData: String,
  size: androidx.compose.ui.unit.Dp,
  bg: Color,
  tint: Color,
  enabled: Boolean,
  onClick: () -> Unit,
) {
  Box(
    modifier = Modifier
      .size(size)
      .clip(CircleShape)
      .background(if (enabled) bg else bg.copy(alpha = 0.4f))
      .clickable(enabled = enabled, onClick = onClick),
    contentAlignment = Alignment.Center,
  ) {
    VectorIcon(pathData, Modifier.size(size * 0.38f), if (enabled) tint else tint.copy(alpha = 0.4f))
  }
}

@Composable
private fun Equalizer(playing: Boolean, color: Color) {
  val transition = if (playing) rememberInfiniteTransition(label = "eq") else null
  Row(
    verticalAlignment = Alignment.Bottom,
    horizontalArrangement = Arrangement.spacedBy(d(3f)),
    modifier = Modifier.height(d(20f)),
  ) {
    // Mesmos tempos do design: 0,65 s + 0,14 por barra.
    repeat(5) { i ->
      val still = listOf(0.3f, 0.6f, 0.45f, 0.75f, 0.35f)[i]
      val h = if (transition != null) {
        val animated by transition.animateFloat(
          initialValue = 0.28f,
          targetValue = 1f,
          animationSpec = infiniteRepeatable(
            tween(((0.65f + i * 0.14f) * 1000).toInt()),
            RepeatMode.Reverse,
          ),
          label = "bar$i",
        )
        animated
      } else {
        still
      }
      Box(
        Modifier
          .width(d(3f))
          .height(d(20f) * h)
          .clip(RoundedCornerShape(2.dp))
          .background(color)
      )
    }
  }
}

/* ── diário por voz ─────────────────────────────────────────────────────── */

/**
 * DIÁRIO POR VOZ: microfone com anel pulsando e a onda.
 *
 * Usa o reconhecimento de fala do proprio sistema (a tela que o Wear ja abre),
 * nao uma gravacao nossa: assim nenhum audio sai do aparelho — o que volta e
 * so o texto. Para um app de dado emocional isso importa.
 */
@Composable
fun VoiceScreen(
  lastNote: String?,
  listening: Boolean,
  onSpeak: () -> Unit,
) {
  WatchScreen(ringProgress = 0f, ringColor = Mellow.Primary, showRing = false) {
    Column(
      modifier = Modifier.padding(horizontal = d(40f), vertical = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Box(contentAlignment = Alignment.Center) {
        if (listening) {
          val ring by rememberInfiniteTransition(label = "ring").animateFloat(
            initialValue = 0.8f,
            targetValue = 1.5f,
            animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Restart),
            label = "ringScale",
          )
          Box(
            Modifier
              .size(d(96f))
              .scale(ring)
              .clip(CircleShape)
              .background(Mellow.Primary.copy(alpha = (1.5f - ring).coerceIn(0f, 0.7f)))
          )
        }
        Box(
          modifier = Modifier
            .size(d(96f))
            .clip(CircleShape)
            .background(if (listening) Mellow.Primary else Mellow.Surface)
            .clickable(onClick = onSpeak),
          contentAlignment = Alignment.Center,
        ) {
          VectorIcon(
            MIC,
            Modifier.size(d(34f)),
            if (listening) Mellow.PrimaryDim else Mellow.TextHigh,
            stroke = true,
          )
        }
      }
      Spacer(Modifier.height(d(10f)))
      Text(
        text = if (listening) "Ouvindo…" else "Diário por voz",
        fontSize = s(17f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
      )
      Text(
        text = lastNote ?: "fale uma frase — vira registro no app",
        fontSize = s(11.5f),
        color = Mellow.TextMid,
        textAlign = TextAlign.Center,
        maxLines = 3,
      )
    }
  }
}

private const val MIC = "M9 3h6v11a3 3 0 01-6 0zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"

/* ── lembrete do pet ────────────────────────────────────────────────────── */

/** LEMBRETE DO PET: aparece quando passa muito tempo sem leitura. */
@Composable
fun NudgeScreen(emotion: Emotion, hoursSince: Int?, onGreet: () -> Unit) {
  WatchScreen(ringProgress = 0f, ringColor = emotion.color, showRing = false) {
    Column(
      modifier = Modifier.padding(horizontal = d(44f), vertical = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      PetFace(emotion = Emotion.SAD, size = d(74f))
      Spacer(Modifier.height(d(10f)))
      Text(
        text = "Faz um tempo…",
        fontSize = s(17f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
        textAlign = TextAlign.Center,
      )
      Text(
        text = hoursSince?.let { "Última leitura há ${it}h. Como você está?" }
          ?: "Sem leitura recente. Como você está?",
        fontSize = s(11.5f),
        color = Mellow.TextMid,
        textAlign = TextAlign.Center,
      )
      Spacer(Modifier.height(d(12f)))
      ActionPill("Dar um oi", Mellow.Primary, Mellow.PrimaryDim, onGreet)
    }
  }
}

/* ── alerta do cuidador ─────────────────────────────────────────────────── */

/** ALERTA DO CUIDADOR: no pulso de quem acompanha. */
@Composable
fun CareAlertScreen(name: String?, detail: String?, onOpen: () -> Unit) {
  WatchScreen(ringProgress = 0f, ringColor = Mellow.StressMid, showRing = false) {
    Box(
      modifier = Modifier.fillMaxSize().background(
        Brush.radialGradient(
          colors = listOf(Mellow.StressMid.copy(alpha = 0.26f), Color.Transparent),
          center = Offset(225f, 100f),
          radius = 380f,
        )
      )
    )
    Column(
      modifier = Modifier.padding(horizontal = d(42f), vertical = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      VectorIcon(ALERT, Modifier.size(d(32f)), Mellow.StressMid, stroke = true)
      Spacer(Modifier.height(d(8f)))
      Text(
        text = name ?: "Acompanhamento",
        fontSize = s(17f),
        fontWeight = FontWeight.Bold,
        color = Mellow.TextHigh,
        textAlign = TextAlign.Center,
      )
      Text(
        text = detail ?: "Nenhum alerta agora.",
        fontSize = s(11.5f),
        color = Mellow.TextMid,
        textAlign = TextAlign.Center,
        maxLines = 3,
      )
      Spacer(Modifier.height(d(12f)))
      ActionPill("Abrir no celular", Mellow.Surface, Mellow.TextHigh, onOpen)
    }
  }
}

private const val ALERT = "M12 8v5M12 16.5h.01M12 3a9 9 0 100 18 9 9 0 000-18z"

/* ── ajuda agora ────────────────────────────────────────────────────────── */

/**
 * AJUDA AGORA: o atalho de crise.
 *
 * O design menciona acionar com cinco toques no botao — isso e configuracao do
 * sistema (SOS do proprio Wear OS), fora do alcance de um app. Aqui e uma tela
 * sempre acessivel, e o CVV disca de verdade.
 */
@Composable
fun HelpScreen(caregiver: String?, onCallCvv: () -> Unit, onCallCaregiver: () -> Unit) {
  WatchScreen(ringProgress = 0f, ringColor = Mellow.StressHigh, showRing = false) {
    Column(
      modifier = Modifier.padding(horizontal = d(36f), vertical = INDICATOR_SPACE),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Text(
        text = "AJUDA AGORA",
        fontSize = s(11f),
        fontWeight = FontWeight.Bold,
        color = Mellow.StressHigh,
      )
      Text(
        text = "Você não precisa resolver sozinho.",
        fontSize = s(13f),
        color = Mellow.TextMid,
        textAlign = TextAlign.Center,
      )
      Spacer(Modifier.height(d(12f)))
      ActionPill("Ligar 188 · CVV", Mellow.StressHigh, Color.White, onCallCvv)
      Spacer(Modifier.height(d(7f)))
      ActionPill(
        caregiver?.let { "Ligar para $it" } ?: "Sem cuidador salvo",
        Mellow.Surface,
        if (caregiver != null) Mellow.TextHigh else Mellow.TextLow,
        onCallCaregiver,
        enabled = caregiver != null,
      )
    }
  }
}

/* ── peças ──────────────────────────────────────────────────────────────── */

@Composable
fun ActionPill(
  label: String,
  bg: Color,
  ink: Color,
  onClick: () -> Unit,
  enabled: Boolean = true,
) {
  Box(
    modifier = Modifier
      .clip(RoundedCornerShape(999.dp))
      .background(if (enabled) bg else bg.copy(alpha = 0.5f))
      .clickable(enabled = enabled, onClick = onClick)
      .padding(horizontal = d(22f), vertical = d(10f)),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, fontSize = s(12.5f), fontWeight = FontWeight.Bold, color = ink, maxLines = 1)
  }
}

/** Desenha um path de 24x24 (os icones do design) no tamanho pedido. */
@Composable
fun VectorIcon(
  pathData: String,
  modifier: Modifier = Modifier,
  tint: Color = Mellow.TextHigh,
  stroke: Boolean = false,
) {
  val path = remember(pathData) { PathParser().parsePathString(pathData).toPath() }
  Canvas(modifier) {
    drawScale(size.minDimension / 24f, pivot = Offset.Zero) {
      if (stroke) {
        drawPath(
          path,
          tint,
          style = androidx.compose.ui.graphics.drawscope.Stroke(
            width = 1.9f,
            cap = StrokeCap.Round,
          ),
        )
      } else {
        drawPath(path, tint)
      }
    }
  }
}
