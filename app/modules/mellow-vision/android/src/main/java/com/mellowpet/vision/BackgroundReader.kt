package com.mellowpet.vision

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Uma leitura facial isolada, sem tela.
 *
 * Diferente de MellowVisionView, aqui não existe preview: a câmera abre só
 * com o ImageReader, tira algumas amostras, entrega a melhor e fecha na
 * hora. É o que torna a leitura em segundo plano viável — a câmera fica
 * ligada por segundos, não o dia todo.
 *
 * Toma alguns frames em vez de um: o primeiro frame de uma câmera recém
 * aberta costuma vir escuro ou fora de foco (auto-exposição ainda
 * convergindo), e descartá-lo evita registrar "sem rosto" à toa.
 */
internal class BackgroundReader(private val context: Context) {

  data class Reading(val emotion: String, val confidence: Double, val scores: Map<String, Double>)

  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  private var camera: CameraDevice? = null
  private var session: CameraCaptureSession? = null
  private var reader: ImageReader? = null
  private var landmarker: FaceLandmarker? = null
  private val busy = AtomicBoolean(false)

  private var framesSeen = 0
  private var best: Reading? = null
  private var onDone: ((Reading?) -> Unit)? = null
  private var sensorOrientation = 270

  /**
   * Abre a câmera, coleta até [MAX_FRAMES] amostras e devolve a leitura com
   * maior confiança. Chama [callback] com `null` quando não há permissão,
   * câmera frontal ou rosto detectado.
   */
  fun readOnce(callback: (Reading?) -> Unit) {
    if (!busy.compareAndSet(false, true)) {
      callback(null)
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
      != PackageManager.PERMISSION_GRANTED
    ) {
      finish(null)
      callback(null)
      return
    }
    onDone = callback
    framesSeen = 0
    best = null

    try {
      val thread = HandlerThread("mellow-bg-vision").also { it.start() }
      this.thread = thread
      handler = Handler(thread.looper)
      ensureLandmarker()
      openFrontCamera()
      // Rede de segurança: se a câmera travar ou nenhum frame chegar, não
      // deixa o serviço segurando o hardware indefinidamente.
      handler?.postDelayed({ if (busy.get()) deliver() }, TIMEOUT_MS)
    } catch (e: Exception) {
      Log.e(TAG, "falha ao iniciar leitura", e)
      finish(null)
      callback(null)
    }
  }

  private fun ensureLandmarker() {
    if (landmarker != null) return
    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL_ASSET).build())
      // IMAGE em vez de LIVE_STREAM: são poucas amostras avulsas, não um
      // fluxo contínuo — e assim o resultado volta síncrono, sem depender
      // de timestamps monotônicos entre aberturas de câmera.
      .setRunningMode(RunningMode.IMAGE)
      .setNumFaces(1)
      .setMinFaceDetectionConfidence(0.55f)
      .setMinFacePresenceConfidence(0.55f)
      .setMinTrackingConfidence(0.55f)
      .setOutputFaceBlendshapes(true)
      .build()
    landmarker = FaceLandmarker.createFromOptions(context, options)
  }

  private fun openFrontCamera() {
    val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    val id = manager.cameraIdList.firstOrNull { candidate ->
      manager.getCameraCharacteristics(candidate)
        .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
    } ?: run {
      deliver()
      return
    }
    sensorOrientation =
      manager.getCameraCharacteristics(id).get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 270

    val imageReader = ImageReader.newInstance(WIDTH, HEIGHT, ImageFormat.YUV_420_888, 2)
    imageReader.setOnImageAvailableListener({ r ->
      val image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
      try {
        if (framesSeen < MAX_FRAMES) analyze(image) else image.close()
      } catch (e: Exception) {
        image.close()
        Log.e(TAG, "falha ao analisar frame", e)
      }
      if (framesSeen >= MAX_FRAMES) deliver()
    }, handler)
    reader = imageReader

    @Suppress("MissingPermission") // conferido em readOnce
    manager.openCamera(id, object : CameraDevice.StateCallback() {
      override fun onOpened(device: CameraDevice) {
        camera = device
        startSession(device, imageReader)
      }

      override fun onDisconnected(device: CameraDevice) {
        device.close()
        deliver()
      }

      override fun onError(device: CameraDevice, error: Int) {
        Log.e(TAG, "erro ao abrir câmera: $error")
        device.close()
        deliver()
      }
    }, handler)
  }

  @Suppress("DEPRECATION") // createCaptureSession moderno exige API 28+
  private fun startSession(device: CameraDevice, imageReader: ImageReader) {
    device.createCaptureSession(
      listOf(imageReader.surface),
      object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(configured: CameraCaptureSession) {
          session = configured
          val request = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
            addTarget(imageReader.surface)
            set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
          }
          configured.setRepeatingRequest(request.build(), null, handler)
        }

        override fun onConfigureFailed(configured: CameraCaptureSession) {
          Log.e(TAG, "sessão de câmera falhou")
          deliver()
        }
      },
      handler,
    )
  }

  private fun analyze(image: android.media.Image) {
    framesSeen += 1
    val width = image.width
    val height = image.height
    val bitmap = image.use(YuvConverter::toBitmap)
    val matrix = Matrix().apply { postRotate(sensorOrientation.toFloat()) }
    val rotated = android.graphics.Bitmap
      .createBitmap(bitmap, 0, 0, width, height, matrix, true)
    val mp: MPImage = BitmapImageBuilder(rotated).build()

    val result: FaceLandmarkerResult = landmarker?.detect(mp) ?: return
    if (result.faceLandmarks().isEmpty()) return

    val blendshapes = result.faceBlendshapes().orElse(emptyList())
      .firstOrNull()
      ?.associate { it.categoryName() to it.score().toDouble().coerceIn(0.0, 1.0) }
      ?: return

    val scores = BlendshapeScorer.score(blendshapes)
    val (emotion, confidence) = BlendshapeScorer.top(scores)
    // Guarda só a amostra mais confiante da rodada.
    if (confidence > (best?.confidence ?: 0.0)) {
      best = Reading(emotion, confidence, scores)
    }
  }

  private fun deliver() {
    val reading = best
    val callback = onDone
    finish(reading)
    callback?.invoke(reading)
  }

  private fun finish(@Suppress("UNUSED_PARAMETER") reading: Reading?) {
    onDone = null
    try {
      session?.stopRepeating()
    } catch (_: Exception) {
      // sessão já pode ter sido fechada pelo callback de erro
    }
    session?.close()
    session = null
    camera?.close()
    camera = null
    reader?.close()
    reader = null
    thread?.quitSafely()
    thread = null
    handler = null
    busy.set(false)
  }

  /** Libera o modelo. O serviço chama ao parar de vez. */
  fun release() {
    finish(null)
    landmarker?.close()
    landmarker = null
  }

  private companion object {
    const val TAG = "MellowBgReader"
    const val MODEL_ASSET = "face_landmarker.task"
    const val WIDTH = 640
    const val HEIGHT = 480
    const val MAX_FRAMES = 6
    const val TIMEOUT_MS = 6_000L
  }
}
