import ExpoModulesCore

public class MellowVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MellowVision")

    AsyncFunction("getCapabilitiesAsync") {
      return [
        "available": true,
        "cameraPreview": true,
        "faceLandmarker": true,
        "localOnly": true,
        "modelVersion": MellowVisionView.modelVersion,
        "pipelineVersion": MellowVisionView.pipelineVersion,
      ] as [String: Any]
    }

    View(MellowVisionView.self) {
      Events("onVisionResult", "onVisionError")

      Prop("active") { (view: MellowVisionView, active: Bool) in
        view.updateActive(active)
      }

      Prop("maxFps") { (view: MellowVisionView, maxFps: Int) in
        view.updateMaxFps(maxFps)
      }

      Prop("mirror") { (view: MellowVisionView, mirror: Bool) in
        view.updateMirror(mirror)
      }
    }
  }
}
