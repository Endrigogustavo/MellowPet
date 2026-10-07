package com.mellowpet.wear

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.mellowpet.wear.ui.MellowApp
import java.util.Locale

class MainActivity : ComponentActivity() {

  private var bodySensorsGranted by mutableStateOf(false)
  private var voiceNote by mutableStateOf<String?>(null)
  private var listening by mutableStateOf(false)

  private val askBodySensors =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      bodySensorsGranted = granted
    }

  /**
   * Ditado pelo reconhecedor do proprio sistema.
   *
   * De proposito nao gravamos audio: a tela do Wear faz a transcricao e
   * devolve so o texto. Num app de dado emocional, nao ter o audio e a
   * diferenca entre guardar uma frase e guardar a voz de alguem.
   */
  private val speak =
    registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      listening = false
      if (result.resultCode != Activity.RESULT_OK) return@registerForActivityResult
      voiceNote = result.data
        ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        ?.firstOrNull()
        ?.takeIf { it.isNotBlank() }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    bodySensorsGranted = checkSelfPermission(Manifest.permission.BODY_SENSORS) ==
      PackageManager.PERMISSION_GRANTED

    setContent {
      MellowApp(
        bodySensorsGranted = bodySensorsGranted,
        onAskBodySensors = { askBodySensors.launch(Manifest.permission.BODY_SENSORS) },
        onSpeak = ::startDictation,
        voiceNote = voiceNote,
        listening = listening,
      )
    }
  }

  private fun startDictation() {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale("pt", "BR").toLanguageTag())
      putExtra(RecognizerIntent.EXTRA_PROMPT, "Como foi seu dia?")
    }
    try {
      listening = true
      speak.launch(intent)
    } catch (_: Exception) {
      // Relogio sem reconhecedor instalado: a tela volta ao estado parado.
      listening = false
    }
  }
}
