package com.mellowpet.wear.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import com.mellowpet.wear.data.Emotion
import com.mellowpet.wear.health.HeartRate
import com.mellowpet.wear.sync.CheckinQueue
import com.mellowpet.wear.sync.PhoneLink
import com.mellowpet.wear.sync.StateCache
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Tres telas, sem navegacao: Home (o bichinho), escolha da emocao, confirmacao.
 * Num relogio cada toque a mais e um toque que ninguem da — do mostrador ao
 * check-in gravado sao dois.
 *
 * O layout evita os componentes prontos do Wear Material (Chip, Button) de
 * proposito: eles vem com altura, sombra e cantos fixos que brigam com a tela
 * redonda e com a identidade do app. Aqui as formas sao as do MellowPet.
 */
private enum class Step { HOME, PICK, DONE }

/** Entrega do check-in ao celular. */
private enum class Delivery { SENDING, SENT, QUEUED }

/** Margem para o conteudo nao encostar na moldura redonda. */
private val EDGE = 18.dp

@Composable
fun MellowApp(bodySensorsGranted: Boolean, onAskBodySensors: () -> Unit) {
  val context = LocalContext.current
  var step by remember { mutableStateOf(Step.HOME) }
  var chosen by remember { mutableStateOf<Emotion?>(null) }
  var queued by remember { mutableStateOf(0) }
  var delivery by remember { mutableStateOf(Delivery.SENDING) }

  var state by remember { mutableStateOf(StateCache.read(context)) }
  val scope = rememberCoroutineScope()

  LaunchedEffect(Unit) {
    CheckinQueue.flush(context)
    queued = CheckinQueue.size(context)
    PhoneLink.readState(context)?.let {
      StateCache.write(context, it.emotion, it.level, it.streak, it.checkedInToday)
      state = StateCache.read(context)
    }
  }

  MellowTheme {
    Scaffold(timeText = { if (step == Step.HOME) TimeText() }) {
      when (step) {
        Step.HOME -> HomeScreen(
          emotion = Emotion.fromKey(state.emotion),
          level = state.level,
          streak = state.streak,
          checkedInToday = state.checkedInToday,
          queued = queued,
          onCheckin = { step = Step.PICK },
        )

        Step.PICK -> PickScreen(
          bodySensorsGranted = bodySensorsGranted,
          onAskBodySensors = onAskBodySensors,
          onPick = { emotion, bpm ->
            chosen = emotion
            delivery = Delivery.SENDING
            StateCache.markCheckedIn(context, emotion.key)
            state = StateCache.read(context)
            step = Step.DONE
            scope.launch {
              val payload = buildPayload(emotion, bpm)
              val ok = PhoneLink.sendCheckin(context, payload)
              if (!ok) CheckinQueue.add(context, payload)
              delivery = if (ok) Delivery.SENT else Delivery.QUEUED
              queued = CheckinQueue.size(context)
            }
          },
        )

        Step.DONE -> DoneScreen(
          emotion = chosen ?: Emotion.NEUTRAL,
          delivery = delivery,
          onClose = { step = Step.HOME },
        )
      }
    }
  }
}

private fun buildPayload(emotion: Emotion, bpm: Int?): JSONObject = JSONObject().apply {
  put("emotion", emotion.key)
  put("at", System.currentTimeMillis())
  put("source", "watch")
  if (bpm != null) put("heartRate", bpm)
  put("tags", JSONArray())
}

/* ── peças ──────────────────────────────────────────────────────────────── */

/** Botao principal: pilula cheia na cor da marca. */
@Composable
private fun PrimaryPill(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
  Box(
    modifier = modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(26.dp))
      .background(Mellow.Primary)
      .clickable(onClick = onClick)
      .padding(vertical = 11.dp),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text = label,
      fontSize = 14.sp,
      fontWeight = FontWeight.Bold,
      color = Mellow.PrimaryDim,
    )
  }
}

/** Botao de emocao: o proprio rosto, com a cor da emocao em volta. */
@Composable
private fun EmotionButton(emotion: Emotion, onClick: () -> Unit) {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = Modifier
      .width(74.dp)
      .clip(RoundedCornerShape(20.dp))
      .clickable(onClick = onClick)
      .padding(vertical = 7.dp),
  ) {
    Box(
      modifier = Modifier
        .size(50.dp)
        .clip(CircleShape)
        .background(emotion.color.copy(alpha = 0.16f))
        .border(1.5.dp, emotion.color.copy(alpha = 0.55f), CircleShape),
      contentAlignment = Alignment.Center,
    ) {
      PetFace(emotion = emotion, size = 38.dp, breathing = false)
    }
    Spacer(Modifier.height(3.dp))
    Text(
      text = emotion.label,
      fontSize = 10.sp,
      fontWeight = FontWeight.Medium,
      color = Mellow.TextMid,
      maxLines = 1,
    )
  }
}

/* ── telas ──────────────────────────────────────────────────────────────── */

@Composable
private fun HomeScreen(
  emotion: Emotion,
  level: Int,
  streak: Int,
  checkedInToday: Boolean,
  queued: Int,
  onCheckin: () -> Unit,
) {
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = EDGE),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    Spacer(Modifier.height(10.dp))
    PetFace(emotion = emotion, size = 86.dp)
    Spacer(Modifier.height(2.dp))
    Text(
      text = emotion.label,
      color = emotion.color,
      fontSize = 17.sp,
      fontWeight = FontWeight.Bold,
    )
    Spacer(Modifier.height(2.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
      Text("Nível $level", fontSize = 11.sp, color = Mellow.TextLow)
      Dot()
      Text(
        text = "$streak ${if (streak == 1) "dia" else "dias"}",
        fontSize = 11.sp,
        color = Mellow.TextLow,
      )
    }
    Spacer(Modifier.height(11.dp))
    PrimaryPill(
      label = if (checkedInToday) "Registrar de novo" else "Como estou",
      onClick = onCheckin,
    )
    if (queued > 0) {
      Spacer(Modifier.height(5.dp))
      Text(
        text = "$queued aguardando o celular",
        color = Mellow.TextLow,
        fontSize = 9.5.sp,
        textAlign = TextAlign.Center,
      )
    }
  }
}

@Composable
private fun Dot() {
  Box(
    Modifier
      .padding(horizontal = 5.dp)
      .size(2.5.dp)
      .clip(CircleShape)
      .background(Mellow.TextLow),
  )
}

@Composable
private fun PickScreen(
  bodySensorsGranted: Boolean,
  onAskBodySensors: () -> Unit,
  onPick: (Emotion, Int?) -> Unit,
) {
  val context: Context = LocalContext.current
  var bpm by remember { mutableStateOf<Int?>(null) }
  var hrSupported by remember { mutableStateOf<Boolean?>(null) }

  LaunchedEffect(bodySensorsGranted) {
    if (!bodySensorsGranted) return@LaunchedEffect
    hrSupported = HeartRate.isSupported(context)
    if (hrSupported == true) {
      HeartRate.stream(context).collectLatest { r ->
        if (r is HeartRate.Reading.Bpm) bpm = r.value
      }
    }
  }

  // Em pares: duas carinhas por linha cabem bem no circulo, e a rolagem do
  // ScalingLazyColumn ja encolhe as pontas, o que ajuda a leitura na borda.
  val rows = remember { Emotion.entries.chunked(2) }
  val listState: ScalingLazyListState = rememberScalingLazyListState()

  ScalingLazyColumn(
    state = listState,
    modifier = Modifier.fillMaxSize(),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    item {
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
          text = "Como você está?",
          fontSize = 15.sp,
          fontWeight = FontWeight.Bold,
          color = Mellow.TextHigh,
          textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(3.dp))
        HeartLine(bodySensorsGranted, hrSupported, bpm, onAskBodySensors)
      }
    }
    items(rows.size) { i ->
      Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        rows[i].forEach { e -> EmotionButton(e) { onPick(e, bpm) } }
      }
    }
  }
}

@Composable
private fun HeartLine(granted: Boolean, supported: Boolean?, bpm: Int?, onAsk: () -> Unit) {
  when {
    !granted -> Text(
      text = "tocar para medir batimentos",
      fontSize = 9.5.sp,
      color = Mellow.Primary,
      modifier = Modifier.clickable(onClick = onAsk).padding(4.dp),
    )

    supported == false -> Text("sem sensor", fontSize = 9.5.sp, color = Mellow.TextLow)

    else -> Row(verticalAlignment = Alignment.CenterVertically) {
      Box(Modifier.size(5.dp).clip(CircleShape).background(Mellow.Blush))
      Spacer(Modifier.width(4.dp))
      Text(
        text = if (bpm != null) "$bpm bpm" else "medindo…",
        fontSize = 10.sp,
        color = Mellow.TextLow,
      )
    }
  }
}

@Composable
private fun DoneScreen(emotion: Emotion, delivery: Delivery, onClose: () -> Unit) {
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = EDGE),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PetFace(emotion = emotion, size = 76.dp)
    Spacer(Modifier.height(4.dp))
    Text(
      text = when (delivery) {
        Delivery.SENDING -> "Salvando…"
        Delivery.SENT -> "Registrado"
        Delivery.QUEUED -> "Guardado"
      },
      fontSize = 16.sp,
      fontWeight = FontWeight.Bold,
      color = emotion.color,
    )
    Spacer(Modifier.height(1.dp))
    Text(
      text = when (delivery) {
        Delivery.SENDING -> "enviando ao celular"
        Delivery.SENT -> "O Mellow está com você."
        Delivery.QUEUED -> "Sem o celular por perto. Envio quando reconectar."
      },
      fontSize = 10.5.sp,
      textAlign = TextAlign.Center,
      color = Mellow.TextLow,
    )
    Spacer(Modifier.height(12.dp))
    PrimaryPill(label = "Pronto", onClick = onClose)
  }
}
