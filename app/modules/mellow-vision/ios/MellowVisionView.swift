import AVFoundation
import ExpoModulesCore
import MediaPipeTasksVision
import UIKit

final class MellowVisionView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate,
  FaceLandmarkerLiveStreamDelegate {
  static let modelVersion = "mediapipe-face-landmarker-float16-v1"
  static let pipelineVersion = "mellow-vision-v2.0.0"

  private let onVisionResult = EventDispatcher()
  private let onVisionError = EventDispatcher()
  private let session = AVCaptureSession()
  private lazy var previewLayer = AVCaptureVideoPreviewLayer(session: session)
  private let sessionQueue = DispatchQueue(label: "com.mellowpet.vision.camera")
  private let processingQueue = DispatchQueue(label: "com.mellowpet.vision.inference")
  private let stateLock = NSLock()
  private var faceLandmarker: FaceLandmarker?
  private var configured = false
  private var active = false
  private var mirror = true
  private var maxFps = 10
  private var lastSubmittedAtMs = 0
  private var inFlight = false
  private var droppedFrames = 0
  private var receivedFrames = 0
  private var processedFrames = 0
  private var pipelineStartedAtMs = 0
  private var initializationLatencyMs = 0
  private var pendingFrames: [Int: FrameMeta] = [:]

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    previewLayer.videoGravity = .resizeAspectFill
    layer.insertSublayer(previewLayer, at: 0)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      stopPipeline()
    } else if active {
      startPipeline()
    }
  }

  func updateActive(_ value: Bool) {
    guard active != value else { return }
    active = value
    value ? startPipeline() : stopPipeline()
  }

  func updateMaxFps(_ value: Int) {
    maxFps = min(15, max(2, value))
  }

  func updateMirror(_ value: Bool) {
    mirror = value
    previewLayer.connection?.automaticallyAdjustsVideoMirroring = false
    previewLayer.connection?.isVideoMirrored = value
  }

  private func startPipeline() {
    guard active, window != nil else { return }
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      emitError(code: "permission_denied", message: "Permissão de câmera não concedida.", recoverable: true)
      return
    }
    sessionQueue.async { [weak self] in
      guard let self, self.active else { return }
      do {
        if !self.configured { try self.configureSession() }
        if !self.session.isRunning {
          self.stateLock.lock()
          self.droppedFrames = 0
          self.receivedFrames = 0
          self.processedFrames = 0
          self.initializationLatencyMs = 0
          self.pipelineStartedAtMs = Int(CACurrentMediaTime() * 1_000)
          self.stateLock.unlock()
          self.session.startRunning()
        }
      } catch {
        self.emitError(code: "camera_initialization_failed", message: error.localizedDescription, recoverable: true)
      }
    }
  }

  private func configureSession() throws {
    guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
      throw VisionError.cameraUnavailable
    }
    guard let modelPath = Self.modelPath() else { throw VisionError.modelUnavailable }

    let options = FaceLandmarkerOptions()
    options.runningMode = .liveStream
    options.numFaces = 1
    options.minFaceDetectionConfidence = 0.55
    options.minFacePresenceConfidence = 0.55
    options.minTrackingConfidence = 0.55
    options.outputFaceBlendshapes = true
    options.baseOptions.modelAssetPath = modelPath
    options.baseOptions.delegate = .CPU
    options.faceLandmarkerLiveStreamDelegate = self
    faceLandmarker = try FaceLandmarker(options: options)

    session.beginConfiguration()
    defer { session.commitConfiguration() }
    session.sessionPreset = .vga640x480
    let input = try AVCaptureDeviceInput(device: camera)
    guard session.canAddInput(input) else { throw VisionError.cameraUnavailable }
    session.addInput(input)

    let output = AVCaptureVideoDataOutput()
    output.alwaysDiscardsLateVideoFrames = true
    output.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    ]
    output.setSampleBufferDelegate(self, queue: processingQueue)
    guard session.canAddOutput(output) else { throw VisionError.cameraUnavailable }
    session.addOutput(output)
    if let connection = output.connection(with: .video) {
      connection.videoOrientation = .portrait
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = mirror
    }
    DispatchQueue.main.async { [weak self] in
      self?.previewLayer.connection?.automaticallyAdjustsVideoMirroring = false
      self?.previewLayer.connection?.isVideoMirrored = self?.mirror ?? true
    }
    configured = true
  }

  private func stopPipeline() {
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if self.session.isRunning { self.session.stopRunning() }
      self.stateLock.lock()
      self.inFlight = false
      self.pendingFrames.removeAll()
      self.stateLock.unlock()
    }
  }

  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard active else { return }
    let timestamp = Int(CACurrentMediaTime() * 1_000)
    let interval = 1_000 / effectiveMaxFps()
    stateLock.lock()
    receivedFrames += 1
    if timestamp - lastSubmittedAtMs < interval || inFlight {
      droppedFrames += 1
      stateLock.unlock()
      return
    }
    lastSubmittedAtMs = timestamp
    inFlight = true
    let meta = computeFrameStats(sampleBuffer: sampleBuffer)
    pendingFrames[timestamp] = meta
    stateLock.unlock()

    do {
      let orientation: UIImage.Orientation = mirror ? .leftMirrored : .right
      let image = try MPImage(sampleBuffer: sampleBuffer, orientation: orientation)
      try faceLandmarker?.detectAsync(image: image, timestampInMilliseconds: timestamp)
    } catch {
      stateLock.lock()
      pendingFrames.removeValue(forKey: timestamp)
      inFlight = false
      stateLock.unlock()
      emitError(code: "frame_processing_failed", message: error.localizedDescription, recoverable: true)
    }
  }

  func faceLandmarker(
    _ faceLandmarker: FaceLandmarker,
    didFinishDetection result: FaceLandmarkerResult?,
    timestampInMilliseconds: Int,
    error: Error?
  ) {
    stateLock.lock()
    let meta = pendingFrames.removeValue(forKey: timestampInMilliseconds) ?? FrameMeta()
    inFlight = false
    processedFrames += 1
    if initializationLatencyMs == 0, pipelineStartedAtMs > 0 {
      initializationLatencyMs = max(1, Int(CACurrentMediaTime() * 1_000) - pipelineStartedAtMs)
    }
    let dropped = droppedFrames
    let received = receivedFrames
    let processed = processedFrames
    let initializationLatency = initializationLatencyMs
    stateLock.unlock()

    if let error {
      emitError(code: "inference_failed", message: error.localizedDescription, recoverable: true)
      return
    }
    guard let result, let landmarks = result.faceLandmarks.first else {
      emitResult(
        status: "no_face", qualityScore: 0, qualityReasons: ["no_face"], blendshapes: [:],
        geometry: FaceGeometry(), meta: meta, timestamp: timestampInMilliseconds, dropped: dropped,
        received: received, processed: processed, initializationLatency: initializationLatency)
      return
    }

    let geometry = computeGeometry(points: landmarks.map { Point(x: Double($0.x), y: Double($0.y)) })
    var blendshapes: [String: Double] = [:]
    if let classifications = result.faceBlendshapes.first {
      for category in classifications.categories {
        blendshapes[category.categoryName] = min(1, max(0, Double(category.score)))
      }
    }
    let reasons = qualityReasons(meta: meta, geometry: geometry)
    emitResult(
      status: reasons.isEmpty ? "ready" : "insufficient_quality",
      qualityScore: qualityScore(meta: meta, geometry: geometry),
      qualityReasons: reasons,
      blendshapes: blendshapes,
      geometry: geometry,
      meta: meta,
      timestamp: timestampInMilliseconds,
      dropped: dropped,
      received: received,
      processed: processed,
      initializationLatency: initializationLatency)
  }

  private func emitResult(
    status: String,
    qualityScore: Double,
    qualityReasons: [String],
    blendshapes: [String: Double],
    geometry: FaceGeometry,
    meta: FrameMeta,
    timestamp: Int,
    dropped: Int,
    received: Int,
    processed: Int,
    initializationLatency: Int
  ) {
    let payload: [String: Any] = [
      "status": status,
      "qualityScore": qualityScore,
      "qualityReasons": qualityReasons,
      "blendshapes": blendshapes,
      "faceCoverage": geometry.coverage,
      "brightness": meta.brightness,
      "contrast": meta.contrast,
      "sharpness": meta.sharpness,
      "yaw": geometry.yaw,
      "pitch": geometry.pitch,
      "roll": geometry.roll,
      "latencyMs": max(0, Int(CACurrentMediaTime() * 1_000) - timestamp),
      "capturedAtMs": meta.capturedAtMs,
      "droppedFrames": dropped,
      "receivedFrames": received,
      "processedFrames": processed,
      "effectiveFps": effectiveMaxFps(),
      "thermalState": thermalState(),
      "initializationLatencyMs": initializationLatency,
      "modelVersion": Self.modelVersion,
      "pipelineVersion": Self.pipelineVersion,
    ]
    DispatchQueue.main.async { [weak self] in
      guard let self, self.active, self.window != nil else { return }
      self.onVisionResult(payload)
    }
  }

  private func emitError(code: String, message: String, recoverable: Bool) {
    DispatchQueue.main.async { [weak self] in
      self?.onVisionError(["code": code, "message": message, "recoverable": recoverable])
    }
  }

  private func computeFrameStats(sampleBuffer: CMSampleBuffer) -> FrameMeta {
    guard let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return FrameMeta() }
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { return FrameMeta() }
    let width = CVPixelBufferGetWidth(buffer)
    let height = CVPixelBufferGetHeight(buffer)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    let pointer = base.assumingMemoryBound(to: UInt8.self)
    let stepX = max(1, width / 64)
    let stepY = max(1, height / 64)
    var values: [Double] = []
    values.reserveCapacity(4_096)
    var y = 0
    while y < height {
      var x = 0
      while x < width {
        let offset = y * bytesPerRow + x * 4
        let b = Double(pointer[offset])
        let g = Double(pointer[offset + 1])
        let r = Double(pointer[offset + 2])
        values.append((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0)
        x += stepX
      }
      y += stepY
    }
    guard !values.isEmpty else { return FrameMeta() }
    let mean = values.reduce(0, +) / Double(values.count)
    let variance = values.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(values.count)
    var gradient = 0.0
    for index in 1..<values.count { gradient += abs(values[index] - values[index - 1]) }
    return FrameMeta(
      brightness: min(1, max(0, mean)),
      contrast: min(1, max(0, sqrt(variance) * 2)),
      sharpness: min(1, max(0, gradient / Double(max(1, values.count - 1)) * 8)),
      capturedAtMs: Int(Date().timeIntervalSince1970 * 1_000))
  }

  private func computeGeometry(points: [Point]) -> FaceGeometry {
    guard points.count > 263 else { return FaceGeometry() }
    let minX = points.map(\.x).min() ?? 0
    let maxX = points.map(\.x).max() ?? 0
    let minY = points.map(\.y).min() ?? 0
    let maxY = points.map(\.y).max() ?? 0
    let width = max(0.001, maxX - minX)
    let height = max(0.001, maxY - minY)
    let nose = points[1]
    let leftEye = points[33]
    let rightEye = points[263]
    return FaceGeometry(
      coverage: min(1, max(0, width * height)),
      yaw: min(1, max(-1, (nose.x - (minX + maxX) / 2) / width * 2)),
      pitch: min(1, max(-1, (nose.y - (minY + maxY) / 2) / height * 2)),
      roll: min(1, max(-1, atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) / (.pi / 4))))
  }

  private func qualityReasons(meta: FrameMeta, geometry: FaceGeometry) -> [String] {
    var reasons: [String] = []
    if meta.brightness < 0.18 { reasons.append("too_dark") }
    if meta.brightness > 0.88 { reasons.append("overexposed") }
    if meta.contrast < 0.25 { reasons.append("low_contrast") }
    if meta.sharpness < 0.22 { reasons.append("blurred") }
    if geometry.coverage < 0.08 { reasons.append("face_too_small") }
    if abs(geometry.yaw) > 0.42 || abs(geometry.pitch) > 0.48 || abs(geometry.roll) > 0.45 {
      reasons.append("pose_out_of_range")
    }
    return reasons
  }

  private func qualityScore(meta: FrameMeta, geometry: FaceGeometry) -> Double {
    let lighting = min(1, max(0, 1 - abs(meta.brightness - 0.53) / 0.53))
    let pose = min(1, max(0, 1 - max(abs(geometry.yaw), max(abs(geometry.pitch), abs(geometry.roll)))))
    let size = min(1, max(0, geometry.coverage / 0.20))
    return min(1, max(0,
      0.18 * lighting + 0.22 * meta.contrast + 0.32 * meta.sharpness + 0.18 * pose + 0.10 * size))
  }

  private func effectiveMaxFps() -> Int {
    switch ProcessInfo.processInfo.thermalState {
    case .critical: return min(maxFps, 4)
    case .serious: return min(maxFps, 7)
    case .nominal, .fair: return maxFps
    @unknown default: return min(maxFps, 7)
    }
  }

  private func thermalState() -> String {
    switch ProcessInfo.processInfo.thermalState {
    case .nominal: return "nominal"
    case .fair: return "fair"
    case .serious: return "serious"
    case .critical: return "critical"
    @unknown default: return "unknown"
    }
  }

  private static func modelPath() -> String? {
    if let path = Bundle.main.path(forResource: "face_landmarker", ofType: "task") { return path }
    return Bundle(for: MellowVisionView.self).path(forResource: "face_landmarker", ofType: "task")
  }

  private struct FrameMeta {
    let brightness: Double
    let contrast: Double
    let sharpness: Double
    let capturedAtMs: Int

    init(brightness: Double = 0, contrast: Double = 0, sharpness: Double = 0,
         capturedAtMs: Int = Int(Date().timeIntervalSince1970 * 1_000)) {
      self.brightness = brightness
      self.contrast = contrast
      self.sharpness = sharpness
      self.capturedAtMs = capturedAtMs
    }
  }

  private struct Point { let x: Double; let y: Double }
  private struct FaceGeometry {
    let coverage: Double
    let yaw: Double
    let pitch: Double
    let roll: Double

    init(coverage: Double = 0, yaw: Double = 0, pitch: Double = 0, roll: Double = 0) {
      self.coverage = coverage
      self.yaw = yaw
      self.pitch = pitch
      self.roll = roll
    }
  }

  private enum VisionError: LocalizedError {
    case cameraUnavailable
    case modelUnavailable

    var errorDescription: String? {
      switch self {
      case .cameraUnavailable: return "Câmera frontal indisponível."
      case .modelUnavailable: return "Modelo facial local indisponível."
      }
    }
  }
}
