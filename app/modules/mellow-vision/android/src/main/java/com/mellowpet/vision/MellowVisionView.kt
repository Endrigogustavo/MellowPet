package com.mellowpet.vision

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class MellowVisionView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onVisionResult by EventDispatcher<Map<String, Any?>>()
  private val onVisionError by EventDispatcher<Map<String, Any>>()

  private val previewView = PreviewView(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
    setBackgroundColor(Color.BLACK)
  }
  private val mainExecutor = ContextCompat.getMainExecutor(context)
  private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
  private var analysisExecutor: ExecutorService? = null
  private var cameraProvider: ProcessCameraProvider? = null
  private var preview: Preview? = null
  private var analysis: ImageAnalysis? = null
  private var faceLandmarker: FaceLandmarker? = null
  private var active = false
  private var attached = false
  private var bound = false
  private var maxFps = 10
  private var mirror = true
  private val inferenceInFlight = AtomicBoolean(false)
  private val droppedFrames = AtomicLong(0)
  private val receivedFrames = AtomicLong(0)
  private val processedFrames = AtomicLong(0)
  private val pipelineStartedAtMs = AtomicLong(0)
  private val initializationLatencyMs = AtomicLong(0)
  private val lastSubmittedAtMs = AtomicLong(0)
  private val lastTimestampMs = AtomicLong(0)
  private val pendingFrames = ConcurrentHashMap<Long, FrameMeta>()

  init {
    addView(previewView)
  }

  fun updateActive(value: Boolean) {
    if (active == value) return
    active = value
    if (active) startIfPossible() else stopPipeline()
  }

  fun updateMaxFps(value: Int) {
    maxFps = value.coerceIn(2, 15)
  }

  fun updateMirror(value: Boolean) {
    mirror = value
    // PreviewView ja aplica a transformacao da camera frontal. Inverter a
    // View novamente desespelhava a pre-visualizacao em alguns aparelhos.
    // `mirror` permanece explicito para normalizar o bitmap da inferencia.
    previewView.scaleX = 1f
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attached = true
    startIfPossible()
  }

  override fun onDetachedFromWindow() {
    attached = false
    stopPipeline()
    super.onDetachedFromWindow()
  }

  private fun startIfPossible() {
    if (!active || !attached || bound) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      emitError("permission_denied", "Permissão de câmera não concedida.", true)
      return
    }

    val activity = appContext.currentActivity
    val lifecycleOwner = activity as? LifecycleOwner
    if (lifecycleOwner == null) {
      emitError("camera_unavailable", "Activity sem ciclo de vida compatível com a câmera.", true)
      return
    }

    val executor = analysisExecutor?.takeUnless { it.isShutdown } ?: Executors.newSingleThreadExecutor().also {
      analysisExecutor = it
    }
    droppedFrames.set(0)
    receivedFrames.set(0)
    processedFrames.set(0)
    initializationLatencyMs.set(0)
    pipelineStartedAtMs.set(SystemClock.uptimeMillis())

    executor.execute {
      if (!active || !attached) return@execute
      try {
        ensureLandmarker()
      } catch (error: RuntimeException) {
        emitError("model_initialization_failed", error.message ?: "Falha ao iniciar o modelo facial.", false)
        return@execute
      }

      val providerFuture = ProcessCameraProvider.getInstance(context)
      providerFuture.addListener({
        if (!active || !attached) return@addListener
        try {
          val provider = providerFuture.get()
          val cameraPreview = Preview.Builder().build().also {
            it.surfaceProvider = previewView.surfaceProvider
          }
          val imageAnalysis = ImageAnalysis.Builder()
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setResolutionSelector(
              ResolutionSelector.Builder()
                .setResolutionStrategy(
                  ResolutionStrategy(
                    Size(640, 480),
                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                  )
                )
                .build()
            )
            .build()
            .also { useCase -> useCase.setAnalyzer(executor, ::analyzeFrame) }

          provider.unbind(cameraPreview, imageAnalysis)
          provider.bindToLifecycle(
            lifecycleOwner,
            CameraSelector.DEFAULT_FRONT_CAMERA,
            cameraPreview,
            imageAnalysis,
          )
          cameraProvider = provider
          preview = cameraPreview
          analysis = imageAnalysis
          bound = true
        } catch (error: Exception) {
          emitError("camera_bind_failed", error.message ?: "Não foi possível abrir a câmera frontal.", true)
        }
      }, mainExecutor)
    }
  }

  private fun ensureLandmarker() {
    if (faceLandmarker != null) return
    val baseOptions = BaseOptions.builder()
      .setModelAssetPath(MODEL_ASSET)
      .build()
    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumFaces(1)
      .setMinFaceDetectionConfidence(0.55f)
      .setMinFacePresenceConfidence(0.55f)
      .setMinTrackingConfidence(0.55f)
      .setOutputFaceBlendshapes(true)
      .setResultListener(::handleResult)
      .setErrorListener(::handleLandmarkerError)
      .build()
    faceLandmarker = FaceLandmarker.createFromOptions(context, options)
  }

  private fun analyzeFrame(imageProxy: ImageProxy) {
    receivedFrames.incrementAndGet()
    if (!active || !attached) {
      imageProxy.close()
      return
    }

    val now = SystemClock.elapsedRealtime()
    val interval = 1_000L / effectiveMaxFps()
    if (now - lastSubmittedAtMs.get() < interval || !inferenceInFlight.compareAndSet(false, true)) {
      droppedFrames.incrementAndGet()
      imageProxy.close()
      return
    }
    lastSubmittedAtMs.set(now)

    val width = imageProxy.width
    val height = imageProxy.height
    val rotation = imageProxy.imageInfo.rotationDegrees
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    try {
      imageProxy.use { proxy ->
        proxy.planes[0].buffer.rewind()
        bitmap.copyPixelsFromBuffer(proxy.planes[0].buffer)
      }
      val frameStats = computeFrameStats(bitmap)
      val matrix = Matrix().apply {
        postRotate(rotation.toFloat())
        if (mirror) postScale(-1f, 1f, width.toFloat(), height.toFloat())
      }
      val normalizedBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height, matrix, true)
      val timestamp = monotonicTimestamp()
      pendingFrames[timestamp] = FrameMeta(
        brightness = frameStats.brightness,
        contrast = frameStats.contrast,
        sharpness = frameStats.sharpness,
        capturedAtMs = System.currentTimeMillis(),
      )
      val mpImage = BitmapImageBuilder(normalizedBitmap).build()
      faceLandmarker?.detectAsync(mpImage, timestamp)
        ?: throw IllegalStateException("Face Landmarker indisponível")
    } catch (error: Exception) {
      inferenceInFlight.set(false)
      emitError("frame_processing_failed", error.message ?: "Falha ao processar frame.", true)
    }
  }

  private fun monotonicTimestamp(): Long {
    while (true) {
      val current = SystemClock.uptimeMillis()
      val previous = lastTimestampMs.get()
      val next = max(current, previous + 1)
      if (lastTimestampMs.compareAndSet(previous, next)) return next
    }
  }

  private fun handleResult(result: FaceLandmarkerResult, input: MPImage) {
    val meta = pendingFrames.remove(result.timestampMs()) ?: FrameMeta()
    inferenceInFlight.set(false)
    processedFrames.incrementAndGet()
    val startedAt = pipelineStartedAtMs.get()
    if (initializationLatencyMs.get() == 0L && startedAt > 0L) {
      initializationLatencyMs.compareAndSet(0L, (SystemClock.uptimeMillis() - startedAt).coerceAtLeast(1))
    }
    val faces = result.faceLandmarks()
    if (faces.isEmpty()) {
      emitResult(
        status = "no_face",
        qualityScore = 0.0,
        qualityReasons = listOf("no_face"),
        blendshapes = emptyMap(),
        geometry = FaceGeometry(),
        meta = meta,
        latencyMs = (SystemClock.uptimeMillis() - result.timestampMs()).coerceAtLeast(0),
      )
      return
    }

    val landmarks = faces.first()
    val geometry = computeGeometry(landmarks.map { Point(it.x().toDouble(), it.y().toDouble()) })
    val blendshapes = result.faceBlendshapes().orElse(emptyList())
      .firstOrNull()
      ?.associate { category -> category.categoryName() to category.score().toDouble().coerceIn(0.0, 1.0) }
      ?: emptyMap()
    val reasons = qualityReasons(meta, geometry)
    val qualityScore = qualityScore(meta, geometry)
    emitResult(
      status = if (reasons.isEmpty()) "ready" else "insufficient_quality",
      qualityScore = qualityScore,
      qualityReasons = reasons,
      blendshapes = blendshapes,
      geometry = geometry,
      meta = meta,
      latencyMs = (SystemClock.uptimeMillis() - result.timestampMs()).coerceAtLeast(0),
    )
  }

  private fun handleLandmarkerError(error: RuntimeException) {
    pendingFrames.clear()
    inferenceInFlight.set(false)
    emitError("inference_failed", error.message ?: "Falha na inferência facial.", true)
  }

  private fun emitResult(
    status: String,
    qualityScore: Double,
    qualityReasons: List<String>,
    blendshapes: Map<String, Double>,
    geometry: FaceGeometry,
    meta: FrameMeta,
    latencyMs: Long,
  ) {
    val payload = mapOf<String, Any?>(
      "status" to status,
      "qualityScore" to qualityScore,
      "qualityReasons" to qualityReasons,
      "blendshapes" to blendshapes,
      "faceCoverage" to geometry.coverage,
      "brightness" to meta.brightness,
      "contrast" to meta.contrast,
      "sharpness" to meta.sharpness,
      "yaw" to geometry.yaw,
      "pitch" to geometry.pitch,
      "roll" to geometry.roll,
      "latencyMs" to latencyMs,
      "capturedAtMs" to meta.capturedAtMs,
      "droppedFrames" to droppedFrames.get(),
      "receivedFrames" to receivedFrames.get(),
      "processedFrames" to processedFrames.get(),
      "effectiveFps" to effectiveMaxFps(),
      "thermalState" to thermalState(),
      "initializationLatencyMs" to initializationLatencyMs.get(),
      "modelVersion" to MODEL_VERSION,
      "pipelineVersion" to PIPELINE_VERSION,
    )
    post { if (active && attached) onVisionResult(payload) }
  }

  private fun emitError(code: String, message: String, recoverable: Boolean) {
    post {
      onVisionError(mapOf("code" to code, "message" to message, "recoverable" to recoverable))
    }
  }

  private fun stopPipeline() {
    val cameraPreview = preview
    val imageAnalysis = analysis
    if (cameraPreview != null || imageAnalysis != null) {
      cameraProvider?.unbind(*listOfNotNull(cameraPreview, imageAnalysis).toTypedArray())
    }
    imageAnalysis?.clearAnalyzer()
    preview = null
    analysis = null
    cameraProvider = null
    bound = false
    pendingFrames.clear()
    inferenceInFlight.set(false)

    val executor = analysisExecutor
    analysisExecutor = null
    executor?.execute {
      faceLandmarker?.close()
      faceLandmarker = null
    }
    executor?.shutdown()
  }

  private fun computeFrameStats(bitmap: Bitmap): FrameStats {
    val sample = Bitmap.createScaledBitmap(bitmap, 64, 64, true)
    val pixels = IntArray(64 * 64)
    sample.getPixels(pixels, 0, 64, 0, 0, 64, 64)
    var sum = 0.0
    var sumSquares = 0.0
    val gray = DoubleArray(pixels.size)
    pixels.forEachIndexed { index, color ->
      val value = (0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)) / 255.0
      gray[index] = value
      sum += value
      sumSquares += value * value
    }
    val mean = sum / gray.size
    val standardDeviation = sqrt(max(0.0, sumSquares / gray.size - mean * mean))
    var gradient = 0.0
    var gradientCount = 0
    for (y in 1 until 64) {
      for (x in 1 until 64) {
        val index = y * 64 + x
        gradient += abs(gray[index] - gray[index - 1]) + abs(gray[index] - gray[index - 64])
        gradientCount += 2
      }
    }
    if (sample !== bitmap) sample.recycle()
    return FrameStats(
      brightness = mean.coerceIn(0.0, 1.0),
      contrast = (standardDeviation * 2.0).coerceIn(0.0, 1.0),
      sharpness = ((gradient / max(1, gradientCount)) * 8.0).coerceIn(0.0, 1.0),
    )
  }

  private fun computeGeometry(points: List<Point>): FaceGeometry {
    if (points.size <= 263) return FaceGeometry()
    val minX = points.minOf { it.x }
    val maxX = points.maxOf { it.x }
    val minY = points.minOf { it.y }
    val maxY = points.maxOf { it.y }
    val width = max(0.001, maxX - minX)
    val height = max(0.001, maxY - minY)
    val nose = points[1]
    val leftEye = points[33]
    val rightEye = points[263]
    val centerX = (minX + maxX) / 2.0
    val centerY = (minY + maxY) / 2.0
    return FaceGeometry(
      coverage = (width * height).coerceIn(0.0, 1.0),
      yaw = ((nose.x - centerX) / width * 2.0).coerceIn(-1.0, 1.0),
      pitch = ((nose.y - centerY) / height * 2.0).coerceIn(-1.0, 1.0),
      roll = (atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) / 0.785398).coerceIn(-1.0, 1.0),
    )
  }

  private fun qualityReasons(meta: FrameMeta, geometry: FaceGeometry): List<String> = buildList {
    if (meta.brightness < 0.18) add("too_dark")
    if (meta.brightness > 0.88) add("overexposed")
    if (meta.contrast < 0.25) add("low_contrast")
    if (meta.sharpness < 0.22) add("blurred")
    if (geometry.coverage < 0.08) add("face_too_small")
    if (abs(geometry.yaw) > 0.42 || abs(geometry.pitch) > 0.48 || abs(geometry.roll) > 0.45) {
      add("pose_out_of_range")
    }
  }

  private fun qualityScore(meta: FrameMeta, geometry: FaceGeometry): Double {
    val lighting = (1.0 - abs(meta.brightness - 0.53) / 0.53).coerceIn(0.0, 1.0)
    val pose = (1.0 - max(abs(geometry.yaw), max(abs(geometry.pitch), abs(geometry.roll)))).coerceIn(0.0, 1.0)
    val size = (geometry.coverage / 0.20).coerceIn(0.0, 1.0)
    return (0.18 * lighting + 0.22 * meta.contrast + 0.32 * meta.sharpness + 0.18 * pose + 0.10 * size)
      .coerceIn(0.0, 1.0)
  }

  private fun effectiveMaxFps(): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return maxFps
    return when {
      powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE -> min(maxFps, 4)
      powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_MODERATE -> min(maxFps, 7)
      else -> maxFps
    }
  }

  private fun thermalState(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "unsupported"
    return when (powerManager.currentThermalStatus) {
      PowerManager.THERMAL_STATUS_NONE -> "nominal"
      PowerManager.THERMAL_STATUS_LIGHT -> "light"
      PowerManager.THERMAL_STATUS_MODERATE -> "moderate"
      PowerManager.THERMAL_STATUS_SEVERE -> "severe"
      PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
      PowerManager.THERMAL_STATUS_EMERGENCY -> "emergency"
      PowerManager.THERMAL_STATUS_SHUTDOWN -> "shutdown"
      else -> "unknown"
    }
  }

  private data class FrameStats(val brightness: Double, val contrast: Double, val sharpness: Double)
  private data class FrameMeta(
    val brightness: Double = 0.0,
    val contrast: Double = 0.0,
    val sharpness: Double = 0.0,
    val capturedAtMs: Long = System.currentTimeMillis(),
  )
  private data class Point(val x: Double, val y: Double)
  private data class FaceGeometry(
    val coverage: Double = 0.0,
    val yaw: Double = 0.0,
    val pitch: Double = 0.0,
    val roll: Double = 0.0,
  )

  companion object {
    const val MODEL_VERSION = "mediapipe-face-landmarker-float16-v1"
    const val PIPELINE_VERSION = "mellow-vision-v2.0.0"
    private const val MODEL_ASSET = "face_landmarker.task"
  }
}
