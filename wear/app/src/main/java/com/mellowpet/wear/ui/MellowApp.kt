package com.mellowpet.wear.ui

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.wear.compose.material.HorizontalPageIndicator
import androidx.wear.compose.material.PageIndicatorState
import androidx.wear.compose.material.Scaffold
import com.mellowpet.wear.data.Emotion
import com.mellowpet.wear.health.HeartRate
import com.mellowpet.wear.sync.CheckinQueue
import com.mellowpet.wear.sync.PhoneLink
import com.mellowpet.wear.sync.StateCache
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * As telas do design, lado a lado, na ordem em que ele as apresenta.
 *
 * Deslizar na horizontal e a navegacao natural do Wear OS — e tambem o que o
 * design assume ao falar em "deslize do mostrador para a direita".
 *
 * Quatro das doze telas do arquivo ficaram de fora por dependerem de coisas
 * que o app ainda nao tem; estao listadas em docs/build-wear.md.
 */
private const val PAGES = 6
private const val PAGE_DIAL = 0
private const val PAGE_MOOD = 1
private const val PAGE_CHECKIN = 2
private const val PAGE_BREATHE = 3
private const val PAGE_HEART = 4
private const val PAGE_FOCUS = 5

/** Leituras guardadas para o grafico. 18 pontos, como no design. */
private const val HISTORY = 18

@Composable
fun MellowApp(bodySensorsGranted: Boolean, onAskBodySensors: () -> Unit) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()

  var state by remember { mutableStateOf(StateCache.read(context)) }
  var chosen by remember { mutableStateOf<Emotion?>(null) }
  var pets by remember { mutableStateOf(0) }

  var bpm by remember { mutableStateOf<Int?>(null) }
  val history = remember { mutableStateListOf<Int>() }

  var breathing by remember { mutableStateOf(false) }
  var breathSecond by remember { mutableStateOf(0) }

  var focusRunning by remember { mutableStateOf(false) }
  var focusRemaining by remember { mutableStateOf(FOCUS_SECONDS) }

  var now by remember { mutableStateOf(Date()) }

  LaunchedEffect(Unit) {
    CheckinQueue.flush(context)
    PhoneLink.readState(context)?.let {
      StateCache.write(context, it.emotion, it.level, it.streak, it.checkedInToday)
      state = StateCache.read(context)
    }
  }

  // Relogio de 1 s: hora do mostrador, fases da respiracao e o foco.
  LaunchedEffect(breathing, focusRunning) {
    while (true) {
      delay(1000)
      now = Date()
      if (breathing) {
        breathSecond += 1
        if (breathSecond >= BREATH_PHASE_SECONDS * 3 * BREATH_CYCLES) {
          breathing = false
          breathSecond = 0
          context.buzz(longArrayOf(0, 60, 80, 60))
        } else if (breathSecond % BREATH_PHASE_SECONDS == 0) {
          // "vibra a cada fase", como pede o design.
          context.buzz(longArrayOf(0, 45))
        }
      }
      if (focusRunning) {
        focusRemaining -= 1
        if (focusRemaining <= 0) {
          focusRunning = false
          focusRemaining = FOCUS_SECONDS
          context.buzz(longArrayOf(0, 90, 90, 90))
        }
      }
    }
  }

  LaunchedEffect(bodySensorsGranted) {
    if (!bodySensorsGranted) return@LaunchedEffect
    if (!HeartRate.isSupported(context)) return@LaunchedEffect
    HeartRate.stream(context).collectLatest { r ->
      if (r is HeartRate.Reading.Bpm) {
        bpm = r.value
        history.add(r.value)
        while (history.size > HISTORY) history.removeAt(0)
      }
    }
  }

  val emotion = chosen ?: Emotion.fromKey(state.emotion)
  val pagerState = rememberPagerState(initialPage = PAGE_DIAL) { PAGES }
  val indicator = remember(pagerState) {
    object : PageIndicatorState {
      override val pageOffset: Float get() = pagerState.currentPageOffsetFraction
      override val selectedPage: Int get() = pagerState.currentPage
      override val pageCount: Int get() = PAGES
    }
  }

  MellowTheme {
    Scaffold(pageIndicator = { HorizontalPageIndicator(pageIndicatorState = indicator) }) {
      HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
        when (page) {
          PAGE_DIAL -> DialScreen(
            emotion = emotion,
            // O bem-estar real mora no celular; ate ele chegar, a sequencia
            // de dias e o que o relogio sabe de concreto.
            wellbeing = (state.streak.coerceAtMost(7) / 7f),
            dateLabel = SimpleDateFormat("EEE d MMM", Locale("pt", "BR")).format(now),
            timeLabel = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now),
            bpm = bpm,
            onPet = {
              pets += 1
              context.buzz(longArrayOf(0, 30))
            },
          )

          PAGE_MOOD -> MoodScreen(
            emotion = emotion,
            confidence = if (chosen != null) 1f else 0.74f,
            pets = pets,
            onPet = {
              pets += 1
              context.buzz(longArrayOf(0, 30))
            },
          )

          PAGE_CHECKIN -> CheckinScreen(
            current = Emotion.fromKey(state.emotion),
            chosen = chosen,
            bpm = bpm,
            onPick = { e ->
              chosen = e
              context.buzz(longArrayOf(0, 40))
              StateCache.markCheckedIn(context, e.key)
              state = StateCache.read(context)
              scope.launch {
                val payload = buildPayload(e, bpm)
                if (!PhoneLink.sendCheckin(context, payload)) CheckinQueue.add(context, payload)
              }
            },
          )

          PAGE_BREATHE -> BreatheScreen(
            running = breathing,
            elapsedSeconds = breathSecond,
            color = emotion.color,
            onToggle = {
              breathing = !breathing
              breathSecond = 0
            },
          )

          PAGE_HEART -> HeartScreen(
            bpm = bpm,
            history = history.toList(),
            granted = bodySensorsGranted,
            onAsk = onAskBodySensors,
          )

          PAGE_FOCUS -> FocusScreen(
            running = focusRunning,
            remaining = focusRemaining,
            onToggle = {
              focusRunning = !focusRunning
              if (!focusRunning) focusRemaining = FOCUS_SECONDS
            },
          )
        }
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

/** Vibra no pulso. Silencioso se o aparelho nao tiver vibracao. */
private fun Context.buzz(pattern: LongArray) {
  val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
  } else {
    @Suppress("DEPRECATION")
    getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
  } ?: return
  if (!vibrator.hasVibrator()) return
  vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
}
