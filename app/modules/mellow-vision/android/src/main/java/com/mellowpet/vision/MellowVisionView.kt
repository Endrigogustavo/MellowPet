package com.mellowpet.vision

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.graphics.YuvImage
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.Image
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.os.SystemClock
import android.view.Surface
import android.view.TextureView
import androidx.core.content.ContextCompat
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.ByteArrayOutputStream
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

/**
 * Camera2 direto, sem CameraX. Em alguns aparelhos MIUI/Xiaomi, a camada de
 * injeção de câmera trava/demora a configuração de sessão do CameraX de
 * forma intermitente (às vezes abre sem renderizar, às vezes estoura o
 * timeout de 5s) — sintoma não reproduzido com o app de câmera nativo do
 * mesmo aparelho, então o problema é específico da integração CameraX,
 * não do hardware. Camera2 é a API de mais baixo nível sobre a qual o
 * CameraX é construído; usá-la direto elimina a camada intermediária do
 * CameraX como possível origem do problema.
 */
class MellowVisionView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onVisionResult by EventDispatcher<Map<String, Any?>>()
  private val onVisionError by EventDispatcher<Map<String, Any>>()

  private val textureView = TextureView(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
  }
  private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager

  private var backgroundThread: HandlerThread? = null
  private var backgroundHandler: Handler? = null
  private var analysisExecutor: ExecutorService? = null

  private var cameraDevice: CameraDevice? = null
  private var captureSession: CameraCaptureSession? = null
  private var imageReader: ImageReader? = null
  private var sensorOrientation: Int = 90
  private var faceLandmarker: FaceLandmarker? = null

  private var active = false
  private var attached = false
  private var surfaceReady = false
  private var opening = false
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
    addView(textureView)
    textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
      override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
        surfaceReady = true
        configureTransform()
        startIfPossible()
      }

      override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
        configureTransform()
      }

      override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
        surfaceReady = false
        return true
      }

      override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
    }
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
    textureView.scaleX = if (mirror) -1f else 1f
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
    if (!active || !attached || !surfaceReady || opening || cameraDevice != null) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      emitError("permission_denied", "Permissão de câmera não concedida.", true)
      return
    }
    val id = findFrontCameraId()
    if (id == null) {
      emitError("camera_unavailable", "Nenhuma câmera frontal encontrada.", true)
      return
    }

    ensureBackgroundThread()
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
      openCameraDevice(id)
    }
  }

  private fun findFrontCameraId(): String? {
    for (id in cameraManager.cameraIdList) {
      val chars = cameraManager.getCameraCharacteristics(id)
      if (chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT) {
        sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
        return id
      }
    }
    return null
  }

  private fun ensureBackgroundThread() {
    if (backgroundThread != null) return
    val thread = HandlerThread("MellowVisionCamera2").also { it.start() }
    backgroundThread = thread
    backgroundHandler = Handler(thread.looper)
  }

  @SuppressLint("MissingPermission")
  private fun openCameraDevice(id: String) {
    if (!active || !attached) return
    opening = true
    try {
      cameraManager.openCamera(
        id,
        object : CameraDevice.StateCallback() {
          override fun onOpened(device: CameraDevice) {
            opening = false
            if (!active || !attached) {
              device.close()
              return
            }
            cameraDevice = device
            createSession(device)
          }

          override fun onDisconnected(device: CameraDevice) {
            opening = false
            device.close()
            if (cameraDevice === device) cameraDevice = null
          }

          override fun onError(device: CameraDevice, error: Int) {
            opening = false
            device.close()
            if (cameraDevice === device) cameraDevice = null
            emitError("camera_bind_failed", "Falha ao abrir a câmera frontal (código $error).", true)
          }
        },
        backgroundHandler,
      )
    } catch (error: Exception) {
      opening = false
      emitError("camera_bind_failed", error.message ?: "Não foi possível abrir a câmera frontal.", true)
    }
  }

  private fun createSession(device: CameraDevice) {
    val texture = textureView.surfaceTexture
    if (texture == null) {
      emitError("camera_unavailable", "Superfície de câmera indisponível.", true)
      return
    }
    texture.setDefaultBufferSize(STREAM_WIDTH, STREAM_HEIGHT)
    val previewSurface = Surface(texture)

    val reader = ImageReader.newInstance(STREAM_WIDTH, STREAM_HEIGHT, ImageFormat.YUV_420_888, 2)
    reader.setOnImageAvailableListener(
      { r ->
        val image = r.acquireLatestImage()
        if (image == null) return@setOnImageAvailableListener

        // Decide synchronamente, na mesma thread que adquiriu a imagem, se
        // ela será processada. Adiar isso pro executor deixava imagens
        // acumuladas sem fechar mais rápido do que o maxImages do
        // ImageReader suporta, estourando IllegalStateException.
        receivedFrames.incrementAndGet()
        if (!active || !attached) {
          image.close()
          return@setOnImageAvailableListener
        }
        val now = SystemClock.elapsedRealtime()
        val interval = 1_000L / effectiveMaxFps()
        if (now - lastSubmittedAtMs.get() < interval || !inferenceInFlight.compareAndSet(false, true)) {
          droppedFrames.incrementAndGet()
          image.close()
          return@setOnImageAvailableListener
        }
        lastSubmittedAtMs.set(now)

        val executor = analysisExecutor?.takeUnless { it.isShutdown }
        if (executor != null) {
          executor.execute { analyzeImage(image) }
        } else {
          inferenceInFlight.set(false)
          image.close()
        }
      },
      backgroundHandler,
    )
    imageReader = reader

    try {
      val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
        addTarget(previewSurface)
        addTarget(reader.surface)
        set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
      }

      val outputs = listOf(previewSurface, reader.surface)
      val sessionCallback = object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
          if (!active || !attached) {
            session.close()
            return
          }
          captureSession = session
          try {
            session.setRepeatingRequest(requestBuilder.build(), null, backgroundHandler)
            bound = true
          } catch (error: Exception) {
            emitError("camera_bind_failed", error.message ?: "Falha ao iniciar captura contínua.", true)
          }
        }

        override fun onConfigureFailed(session: CameraCaptureSession) {
          emitError("camera_bind_failed", "Falha ao configurar sessão de câmera.", true)
        }
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val configs = outputs.map { OutputConfiguration(it) }
        device.createCaptureSession(
          SessionConfiguration(
            SessionConfiguration.SESSION_REGULAR,
            configs,
            ContextCompat.getMainExecutor(context),
            sessionCallback,
          )
        )
      } else {
        @Suppress("DEPRECATION")
        device.createCaptureSession(outputs, sessionCallback, backgroundHandler)
      }
    } catch (error: Exception) {
      emitError("camera_bind_failed", error.message ?: "Falha ao criar sessão de câmera.", true)
    }
  }

  /** Ajusta a matriz de transformação do TextureView pra preencher a view
   * (comportamento equivalente ao FILL_CENTER do PreviewView antigo). */
  private fun configureTransform() {
    val viewWidth = textureView.width
    val viewHeight = textureView.height
    if (viewWidth == 0 || viewHeight == 0) return
    val matrix = Matrix()
    val viewRect = RectF(0f, 0f, viewWidth.toFloat(), viewHeight.toFloat())
    val bufferRect = RectF(0f, 0f, STREAM_HEIGHT.toFloat(), STREAM_WIDTH.toFloat())
    bufferRect.offset(viewRect.centerX() - bufferRect.centerX(), viewRect.centerY() - bufferRect.centerY())
    matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)
    val scale = max(viewHeight.toFloat() / STREAM_HEIGHT, viewWidth.toFloat() / STREAM_WIDTH)
    matrix.postScale(scale, scale, viewRect.centerX(), viewRect.centerY())
    textureView.setTransform(matrix)
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

  /** Gate de ativo/taxa já decidido no listener do ImageReader — aqui só
   * processa. `image` sempre chega com `inferenceInFlight` reservado para
   * este frame. */
  private fun analyzeImage(image: Image) {
    val width = image.width
    val height = image.height
    try {
      val nv21 = image.use { img -> yuv420ToNv21(img) }
      val jpegOut = ByteArrayOutputStream()
      YuvImage(nv21, ImageFormat.NV21, width, height, null)
        .compressToJpeg(Rect(0, 0, width, height), 90, jpegOut)
      val jpegBytes = jpegOut.toByteArray()
      val bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
        ?: throw IllegalStateException("Falha ao decodificar frame YUV")
      val frameStats = computeFrameStats(bitmap)
      val matrix = Matrix().apply {
        postRotate(sensorOrientation.toFloat())
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

  /**
   * Converte o YUV_420_888 do Camera2 (3 planos, com row/pixel stride que
   * variam por aparelho) para NV21 respeitando os strides — uma cópia ingênua
   * dos planos gera imagem diagonal/corrompida na maioria dos aparelhos reais.
   */
  private fun yuv420ToNv21(image: Image): ByteArray {
    val width = image.width
    val height = image.height
    val nv21 = ByteArray(width * height * 3 / 2)
    var pos = 0

    val yPlane = image.planes[0]
    val yBuffer = yPlane.buffer
    val yRowStride = yPlane.rowStride
    for (row in 0 until height) {
      yBuffer.position(row * yRowStride)
      yBuffer.get(nv21, pos, width)
      pos += width
    }

    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val uRowStride = uPlane.rowStride
    val vRowStride = vPlane.rowStride
    val uPixelStride = uPlane.pixelStride
    val vPixelStride = vPlane.pixelStride
    val chromaWidth = width / 2
    val chromaHeight = height / 2
    val uRow = ByteArray(uRowStride)
    val vRow = ByteArray(vRowStride)
    for (row in 0 until chromaHeight) {
      vBuffer.position(row * vRowStride)
      vBuffer.get(vRow, 0, min(vRowStride, vBuffer.remaining()))
      uBuffer.position(row * uRowStride)
      uBuffer.get(uRow, 0, min(uRowStride, uBuffer.remaining()))
      for (col in 0 until chromaWidth) {
        nv21[pos++] = vRow[col * vPixelStride]
        nv21[pos++] = uRow[col * uPixelStride]
      }
    }
    return nv21
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
    bound = false
    opening = false
    try {
      captureSession?.close()
    } catch (_: Exception) {
    }
    captureSession = null
    try {
      imageReader?.close()
    } catch (_: Exception) {
    }
    imageReader = null
    try {
      cameraDevice?.close()
    } catch (_: Exception) {
    }
    cameraDevice = null
    pendingFrames.clear()
    inferenceInFlight.set(false)

    val executor = analysisExecutor
    analysisExecutor = null
    executor?.execute {
      faceLandmarker?.close()
      faceLandmarker = null
    }
    executor?.shutdown()

    backgroundThread?.quitSafely()
    backgroundThread = null
    backgroundHandler = null
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
    const val PIPELINE_VERSION = "mellow-vision-v2.0.0-camera2"
    private const val MODEL_ASSET = "face_landmarker.task"
    private const val STREAM_WIDTH = 640
    private const val STREAM_HEIGHT = 480
  }
}
