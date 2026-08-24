package com.mellowpet.vision

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.SurfaceTexture
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
  private var previewSurface: Surface? = null
  private var readerSurface: Surface? = null
  private var sensorOrientation: Int = 90
  private var faceLandmarker: FaceLandmarker? = null

  private var active = false
  private var attached = false
  private var surfaceReady = false
  private var opening = false
  private var bound = false
  private var maxFps = 10
  private var mirror = true
  // Fora da tela de câmera, a view fica fora da área visível (opacity 0,
  // posição negativa) — o Android para de desenhá-la, o que interrompe o
  // consumo do SurfaceTexture do preview. A sessão do Camera2 continua
  // configurada com as duas superfícies (preview + ImageReader) o tempo
  // todo — trocar isso exigiria fechar e reabrir a câmera e reinicializar
  // o FaceLandmarker, o que é lento e torna o reconhecimento visivelmente
  // mais devagar toda vez que a tela muda. Em vez disso, só o CaptureRequest
  // que roda em loop muda: quando escondida, ele nem inclui a superfície de
  // preview como alvo, então a câmera não tenta entregar frame nenhum pra
  // ela — sem alvo sem consumidor, sem trava.
  private var showPreview = true
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
    // Neste aparelho a câmera frontal passa pela camada de injeção da MIUI
    // (CameraExtImplXiaoMi/CameraInjector, visível no logcat) — ela já
    // entrega o preview espelhado por padrão (efeito "espelho" nativo do
    // app de câmera do sistema). Aplicar +1 flip nosso em cima disso
    // cancelava o espelhamento e virava-o ao contrário do esperado, então
    // o sinal aqui é invertido em relação ao gesto óbvio.
    textureView.scaleX = if (mirror) 1f else -1f
  }

  fun updateShowPreview(value: Boolean) {
    if (showPreview == value) return
    showPreview = value
    // A sessão já está configurada com as duas superfícies — só reemite o
    // repeating request com o novo conjunto de alvos. Câmera e modelo
    // continuam rodando sem interrupção.
    val session = captureSession
    val device = cameraDevice
    if (session != null && device != null) {
      try {
        session.setRepeatingRequest(buildRepeatingRequest(device).build(), null, backgroundHandler)
      } catch (_: Exception) {
      }
    }
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
    val preview = Surface(texture)
    previewSurface = preview

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
    readerSurface = reader.surface

    try {
      val outputs = listOf(preview, reader.surface)
      val sessionCallback = object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
          if (!active || !attached) {
            session.close()
            return
          }
          captureSession = session
          try {
            session.setRepeatingRequest(buildRepeatingRequest(device).build(), null, backgroundHandler)
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

  /** Monta o request de captura em loop com o conjunto de alvos atual —
   * ImageReader sempre, superfície de preview só quando `showPreview`. */
  private fun buildRepeatingRequest(device: CameraDevice): CaptureRequest.Builder =
    device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
      readerSurface?.let { addTarget(it) }
      if (showPreview) previewSurface?.let { addTarget(it) }
      set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
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
      val bitmap = image.use(::yuv420ToBitmap)
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
      // Keep the instance stable for this frame. The camera lifecycle may
      // close the shared field while a frame is already being analyzed.
      val landmarker = faceLandmarker
        ?: throw IllegalStateException("Face Landmarker indisponível")
      landmarker.detectAsync(mpImage, timestamp)
    } catch (error: Exception) {
      inferenceInFlight.set(false)
      emitError("frame_processing_failed", error.message ?: "Falha ao processar frame.", true)
    }
  }

  /**
   * Converte YUV_420_888 diretamente para ARGB respeitando row/pixel stride.
   * O pipeline anterior fazia YUV -> JPEG -> Bitmap em todo frame: além de
   * adicionar compressão com perdas antes do modelo, criava buffers grandes e
   * aumentava a latência. A conversão direta mantém os detalhes faciais usados
   * pelos blendshapes e evita a etapa de encode/decode.
   */
  private fun yuv420ToBitmap(image: Image): Bitmap {
    val width = image.width
    val height = image.height
    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val yBuffer = yPlane.buffer
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val yStart = yBuffer.position()
    val uStart = uBuffer.position()
    val vStart = vBuffer.position()
    val pixels = IntArray(width * height)

    for (row in 0 until height) {
      val yRow = yStart + row * yPlane.rowStride
      val uvRow = row / 2
      val uRow = uStart + uvRow * uPlane.rowStride
      val vRow = vStart + uvRow * vPlane.rowStride
      for (col in 0 until width) {
        val y = yBuffer.get(yRow + col * yPlane.pixelStride).toInt() and 0xff
        val uvCol = col / 2
        val u = uBuffer.get(uRow + uvCol * uPlane.pixelStride).toInt() and 0xff
        val v = vBuffer.get(vRow + uvCol * vPlane.pixelStride).toInt() and 0xff

        val c = max(0, y - 16)
        val d = u - 128
        val e = v - 128
        val red = ((298 * c + 409 * e + 128) shr 8).coerceIn(0, 255)
        val green = ((298 * c - 100 * d - 208 * e + 128) shr 8).coerceIn(0, 255)
        val blue = ((298 * c + 516 * d + 128) shr 8).coerceIn(0, 255)
        pixels[row * width + col] = Color.rgb(red, green, blue)
      }
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
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
    previewSurface = null
    readerSurface = null
    pendingFrames.clear()
    inferenceInFlight.set(false)

    // Keep the model alive across camera session restarts. Closing it from a
    // queued executor task could race with the last ImageReader frame and
    // leave analyzeImage() with a null landmarker.
    analysisExecutor?.shutdown()
    analysisExecutor = null

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
    const val PIPELINE_VERSION = "mellow-vision-v3.0.0-camera2-rgb"
    private const val MODEL_ASSET = "face_landmarker.task"
    private const val STREAM_WIDTH = 640
    private const val STREAM_HEIGHT = 480
  }
}
