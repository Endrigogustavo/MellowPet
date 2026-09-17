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

    // iOS não expõe câmera em segundo plano neste módulo. A API existe para
    // manter o contrato multiplataforma explícito: a tela de configurações
    // recebe um estado seguro (desligado) em vez de falhar silenciosamente.
    Function("setBackgroundVision") { (_: Bool, _: Int) in }
    Function("getBackgroundVision") {
      return ["enabled": false, "intervalMinutes": 15] as [String: Any]
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
