package com.mellowpet.wear.ui

import android.content.Context
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
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
 * Tres telas, sem navegacao: Home (o bichinho), escolha da emocao, e confirmacao.
 * Num relogio, cada toque a mais e um toque que ninguem da — o check-in inteiro
 * cabe em dois toques a partir do mostrador.
 */
private enum class Step { HOME, PICK, DONE }

@Composable
fun MellowApp(bodySensorsGranted: Boolean, onAskBodySensors: () -> Unit) {
  val context = LocalContext.current
  var step by remember { mutableStateOf(Step.HOME) }
  var chosen by remember { mutableStateOf<Emotion?>(null) }
  var queued by remember { mutableStateOf(0) }
  var delivered by remember { mutableStateOf(true) }

  var state by remember { mutableStateOf(StateCache.read(context)) }
  val scope = rememberCoroutineScope()

  // Ao abrir: tenta escoar a fila e pedir o estado atual ao celular.
  LaunchedEffect(Unit) {
    CheckinQueue.flush(context)
    queued = CheckinQueue.size(context)
    PhoneLink.readState(context)?.let {
      StateCache.write(context, it.emotion, it.level, it.streak, it.checkedInToday)
      state = StateCache.read(context)
    }
  }

  MaterialTheme {
    Scaffold(
      timeText = { TimeText() },
      vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
    ) {
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
            StateCache.markCheckedIn(context, emotion.key)
            state = StateCache.read(context)
            scope.launch {
              val payload = buildPayload(emotion, bpm)
              val ok = PhoneLink.sendCheckin(context, payload)
              if (!ok) CheckinQueue.add(context, payload)
              delivered = ok
              queued = CheckinQueue.size(context)
            }
            step = Step.DONE
          },
        )

        Step.DONE -> DoneScreen(
          emotion = chosen ?: Emotion.NEUTRAL,
          delivered = delivered,
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
    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PetFace(emotion = emotion, size = 76.dp)
    Spacer(Modifier.height(4.dp))
    Text(
      text = emotion.label,
      color = emotion.color,
      fontSize = 15.sp,
      fontWeight = FontWeight.Bold,
    )
    Text(
      text = "Nível $level · $streak ${if (streak == 1) "dia" else "dias"}",
      color = MaterialTheme.colors.onSurfaceVariant,
      fontSize = 11.sp,
    )
    Spacer(Modifier.height(8.dp))
    Chip(
      onClick = onCheckin,
      label = {
        Text(
          if (checkedInToday) "Registrar de novo" else "Como estou",
          fontSize = 13.sp,
        )
      },
      colors = ChipDefaults.primaryChipColors(),
      modifier = Modifier.fillMaxWidth(),
    )
    if (queued > 0) {
      Spacer(Modifier.height(4.dp))
      Text(
        text = "$queued aguardando o celular",
        color = MaterialTheme.colors.onSurfaceVariant,
        fontSize = 10.sp,
        textAlign = TextAlign.Center,
      )
    }
  }
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

  val listState = rememberScalingLazyListState()
  ScalingLazyColumn(
    state = listState,
    modifier = Modifier.fillMaxSize(),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    item {
      Text(
        text = "Como você está?",
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
      )
    }
    item { HeartRow(bodySensorsGranted, hrSupported, bpm, onAskBodySensors) }
    items(Emotion.entries.toList()) { e ->
      Chip(
        onClick = { onPick(e, bpm) },
        label = { Text(e.label, fontSize = 13.sp) },
        icon = {
          Box(
            Modifier.size(20.dp).clip(CircleShape).background(e.color),
          )
        },
        colors = ChipDefaults.secondaryChipColors(),
        modifier = Modifier.fillMaxWidth(),
      )
    }
  }
}

@Composable
private fun HeartRow(
  granted: Boolean,
  supported: Boolean?,
  bpm: Int?,
  onAsk: () -> Unit,
) {
  when {
    !granted -> Chip(
      onClick = onAsk,
      label = { Text("Medir batimentos", fontSize = 11.sp) },
      colors = ChipDefaults.secondaryChipColors(),
      modifier = Modifier.fillMaxWidth(),
    )

    supported == false -> Text(
      text = "sem sensor de batimentos",
      fontSize = 10.sp,
      color = MaterialTheme.colors.onSurfaceVariant,
    )

    else -> Row(verticalAlignment = Alignment.CenterVertically) {
      Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFFFF7675)))
      Spacer(Modifier.width(6.dp))
      Text(
        text = if (bpm != null) "$bpm bpm" else "medindo…",
        fontSize = 12.sp,
        color = MaterialTheme.colors.onSurfaceVariant,
      )
    }
  }
}

@Composable
private fun DoneScreen(emotion: Emotion, delivered: Boolean, onClose: () -> Unit) {
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PetFace(emotion = emotion, size = 64.dp)
    Spacer(Modifier.height(6.dp))
    Text(
      text = if (delivered) "Registrado" else "Guardado",
      fontSize = 15.sp,
      fontWeight = FontWeight.Bold,
      color = emotion.color,
    )
    Text(
      text = if (delivered) {
        "O Mellow está com você."
      } else {
        "Sem o celular por perto. Envio quando reconectar."
      },
      fontSize = 11.sp,
      textAlign = TextAlign.Center,
      color = MaterialTheme.colors.onSurfaceVariant,
    )
    Spacer(Modifier.height(10.dp))
    Chip(
      onClick = onClose,
      label = { Text("Pronto", fontSize = 13.sp) },
      colors = ChipDefaults.primaryChipColors(),
      modifier = Modifier.fillMaxWidth(),
    )
  }
}
