package com.mellowpet.voice

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val REQUEST_SPEECH = 0x4D56 // "MV"

/**
 * Ditado por voz usando o reconhecedor do sistema.
 *
 * Abre a tela padrão de "fale agora" e devolve o texto reconhecido (ou null se
 * a pessoa cancelar). Sem gravação no app e sem permissão de microfone: quem
 * escuta é o serviço de reconhecimento do aparelho.
 */
class MellowVoiceModule : Module() {

  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("MellowVoice")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
      intent.resolveActivity(context.packageManager) != null
    }

    AsyncFunction("listen") { prompt: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "App não está em primeiro plano.", null)
        return@AsyncFunction
      }
      // Ditado antigo pendurado: encerra sem texto e abre o novo.
      pending?.resolve(null)
      pending = null
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
        putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      }
      pending = promise
      try {
        activity.startActivityForResult(intent, REQUEST_SPEECH)
      } catch (e: ActivityNotFoundException) {
        pending = null
        promise.reject("UNAVAILABLE", "Este aparelho não tem reconhecimento de voz.", e)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_SPEECH) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val text = payload.data
        ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        ?.firstOrNull()
      promise.resolve(text)
    }
  }
}
