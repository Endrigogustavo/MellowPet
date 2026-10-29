package com.mellowpet.wear.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * As onze telas do design, lado a lado, na ordem em que ele as apresenta.
 *
 * Deslizar na horizontal e a navegacao natural do Wear OS — e tambem o que o
 * design assume ao falar em "deslize do mostrador para a direita". A decima
 * segunda tela do arquivo, o BLOCO DE ATALHOS, nao mora aqui: ela e o Tile,
 * que por definicao vive fora do app.
 */
private const val PAGE_DIAL = 0
private const val PAGE_MOOD = 1
private const val PAGE_CHECKIN = 2
private const val PAGE_BREATHE = 3
private const val PAGE_MUSIC = 4
private const val PAGE_HEART = 5
private const val PAGE_FOCUS = 6
private const val PAGE_VOICE = 7
private const val PAGE_NUDGE = 8
private const val PAGE_CARE = 9
private const val PAGE_HELP = 10
private const val PAGES = 11

/** Leituras guardadas para o grafico. 18 pontos, como no design. */
private const val HISTORY = 18

@Composable
fun MellowApp(
  bodySensorsGranted: Boolean,
  onAskBodySensors: () -> Unit,
  onSpeak: () -> Unit,
  voiceNote: String?,
  listening: Boolean,
) {
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
  var reachable by remember { mutableStateOf(false) }
  val dateFormat = remember { SimpleDateFormat("EEE d MMM", Locale("pt", "BR")) }
  val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

  LaunchedEffect(Unit) {
    CheckinQueue.flush(context)
    PhoneLink.readState(context)?.let {
      StateCache.writeAll(context, it)
      state = StateCache.read(context)
    }
    reachable = PhoneLink.hasConnectedNode(context)
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

  fun registerCheckin(e: Emotion, note: String?) {
    chosen = e
    context.buzz(longArrayOf(0, 40))
    StateCache.markCheckedIn(context, e.key)
    state = StateCache.read(context)
    scope.launch {
      val payload = buildPayload(e, bpm, note)
      if (!PhoneLink.sendCheckin(context, payload)) CheckinQueue.add(context, payload)
      reachable = PhoneLink.hasConnectedNode(context)
    }
  }

  // Uma frase ditada vira check-in com nota, usando a emocao ja escolhida ou a
  // ultima lida — o relogio nao adivinha sentimento a partir do texto.
  LaunchedEffect(voiceNote) {
    val note = voiceNote?.takeIf { it.isNotBlank() } ?: return@LaunchedEffect
    registerCheckin(chosen ?: Emotion.fromKey(state.emotion), note)
  }

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
            // O bem-estar real e calculado no celular; ate ele chegar, a
            // sequencia de dias e o que o relogio sabe de concreto.
            wellbeing = state.streak.coerceAtMost(7) / 7f,
            dateLabel = dateFormat.format(now),
            timeLabel = timeFormat.format(now),
            bpm = bpm,
            onPet = { pets += 1; context.buzz(longArrayOf(0, 30)) },
          )

          PAGE_MOOD -> MoodScreen(
            emotion = emotion,
            confidence = if (chosen != null) 1f else 0.74f,
            pets = pets,
            onPet = { pets += 1; context.buzz(longArrayOf(0, 30)) },
          )

          PAGE_CHECKIN -> CheckinScreen(
            current = Emotion.fromKey(state.emotion),
            chosen = chosen,
            bpm = bpm,
            onPick = { registerCheckin(it, null) },
          )

          PAGE_BREATHE -> BreatheScreen(
            running = breathing,
            elapsedSeconds = breathSecond,
            color = emotion.color,
            onToggle = { breathing = !breathing; breathSecond = 0 },
          )

          PAGE_MUSIC -> MusicScreen(
            np = NowPlaying(
              track = state.trackName,
              playlist = state.playlistName,
              playing = state.musicPlaying,
              color = emotion.color,
            ),
            reachable = reachable,
            onPrev = { context.media(PhoneLink.MEDIA_PREV, scope) },
            onToggle = { context.media(PhoneLink.MEDIA_TOGGLE, scope) },
            onNext = { context.media(PhoneLink.MEDIA_NEXT, scope) },
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

          PAGE_VOICE -> VoiceScreen(
            lastNote = voiceNote,
            listening = listening,
            onSpeak = onSpeak,
          )

          PAGE_NUDGE -> NudgeScreen(
            emotion = emotion,
            hoursSince = state.hoursSinceReading,
            onGreet = { registerCheckin(Emotion.NEUTRAL, null) },
          )

          PAGE_CARE -> CareAlertScreen(
            name = state.alertTitle,
            detail = state.alertDetail,
            onOpen = { scope.launch { PhoneLink.sendOpenApp(context) } },
          )

          PAGE_HELP -> HelpScreen(
            caregiver = state.caregiverName,
            onCallCvv = { context.dial("188") },
            onCallCaregiver = { state.caregiverPhone?.let(context::dial) },
          )
        }
      }
    }
  }
}

private fun buildPayload(emotion: Emotion, bpm: Int?, note: String?): JSONObject =
  JSONObject().apply {
    put("emotion", emotion.key)
    put("at", System.currentTimeMillis())
    put("source", "watch")
    if (bpm != null) put("heartRate", bpm)
    if (!note.isNullOrBlank()) put("note", note)
    put("tags", JSONArray())
  }

private fun Context.media(command: String, scope: CoroutineScope) {
  buzz(longArrayOf(0, 25))
  scope.launch { PhoneLink.sendMedia(this@media, command) }
}

/** Abre o discador do relogio. Num modelo sem telefonia ninguem atende o
 * intent, e a tela simplesmente nao muda — melhor que derrubar o app. */
private fun Context.dial(number: String) {
  val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  try {
    startActivity(intent)
  } catch (_: Exception) {
    // Sem discador; nada a fazer no relogio.
  }
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
