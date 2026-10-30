package com.mellowpet.vision

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MellowVisionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MellowVision")

    /**
     * Estado térmico do aparelho (PowerManager.THERMAL_STATUS_*), para a visão
     * reduzir o ritmo antes de aquecer o celular. -1 quando o Android não
     * informa (anterior ao 10).
     */
    Function("thermalStatus") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return@Function -1
      val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
      pm.currentThermalStatus
    }

    AsyncFunction("getCapabilitiesAsync") {
      mapOf(
        "available" to true,
        "cameraPreview" to true,
        "faceLandmarker" to true,
        "localOnly" to true,
        "modelVersion" to MellowVisionView.MODEL_VERSION,
        "pipelineVersion" to MellowVisionView.PIPELINE_VERSION,
      )
    }

    /**
     * Leitura facial com o app fechado. Opt-in: liga um serviço em primeiro
     * plano com notificação permanente, porque desde o Android 9 é a única
     * forma de um app usar a câmera fora da tela — e porque a pessoa precisa
     * ver que está acontecendo.
     */
    Function("setBackgroundVision") { enabled: Boolean, intervalMinutes: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .putBoolean(KEY_ENABLED, enabled)
        .putInt(KEY_INTERVAL, intervalMinutes)
        .apply()
      if (enabled) {
        VisionBackgroundService.start(context, intervalMinutes)
      } else {
        VisionBackgroundService.stop(context)
        context.sendBroadcast(
          android.content.Intent("com.mellowpet.widget.WATCHDOG_CHECK").setPackage(context.packageName),
        )
      }
    }

    Function("getBackgroundVision") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      mapOf(
        "enabled" to prefs.getBoolean(KEY_ENABLED, false),
        "intervalMinutes" to prefs.getInt(KEY_INTERVAL, VisionBackgroundService.DEFAULT_INTERVAL_MIN),
      )
    }

    View(MellowVisionView::class) {
      Events("onVisionResult", "onVisionError")

      Prop("active") { view: MellowVisionView, active: Boolean ->
        view.updateActive(active)
      }

      Prop("maxFps") { view: MellowVisionView, maxFps: Int ->
        view.updateMaxFps(maxFps)
      }

      Prop("mirror") { view: MellowVisionView, mirror: Boolean ->
        view.updateMirror(mirror)
      }

      Prop("showPreview") { view: MellowVisionView, showPreview: Boolean ->
        view.updateShowPreview(showPreview)
      }
    }
  }

  private companion object {
    // Mesmo arquivo de preferências do módulo de widgets: os dois lados
    // precisam enxergar o estado da leitura em segundo plano.
    const val PREFS = "mellow_widget_prefs"
    const val KEY_ENABLED = "vision_bg_enabled"
    const val KEY_INTERVAL = "vision_bg_interval"
  }
}
