package com.mellowpet.vision

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MellowVisionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MellowVision")

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
}
