package com.mellowpet.vision

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

/**
 * Leitura facial com o app fechado.
 *
 * Amostragem periódica, não contínua: a cada [intervalMinutes] a câmera abre
 * por alguns segundos, tira a leitura e fecha. Manter a câmera aberta o dia
 * todo drenaria a bateria e deixaria o indicador de câmera aceso o tempo
 * inteiro — para acompanhar humor ao longo do dia, uma amostra a cada 15
 * minutos diz o mesmo com uma fração do custo.
 *
 * Serviço em primeiro plano com tipo `camera` porque desde o Android 9 um
 * app em segundo plano não tem acesso à câmera — e a notificação permanente
 * é justamente o que torna isso honesto: enquanto a leitura estiver
 * acontecendo, a pessoa vê.
 *
 * O resultado sai por broadcast em vez de chamada direta: assim este módulo
 * não precisa conhecer o de widgets, e quem quiser reagir só escuta.
 */
class VisionBackgroundService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var reader: BackgroundReader? = null
  private var intervalMinutes = DEFAULT_INTERVAL_MIN
  private var lastLabel: String? = null

  private val tick = object : Runnable {
    override fun run() {
      takeReading()
      handler.postDelayed(this, intervalMinutes * 60_000L)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    intervalMinutes = intent?.getIntExtra(EXTRA_INTERVAL, DEFAULT_INTERVAL_MIN)
      ?.coerceIn(MIN_INTERVAL_MIN, MAX_INTERVAL_MIN)
      ?: DEFAULT_INTERVAL_MIN

    startForeground(NOTIFICATION_ID, buildNotification(null))
    reader = reader ?: BackgroundReader(this)
    handler.removeCallbacks(tick)
    // Primeira leitura com folga: deixa a notificação aparecer antes de
    // acender a câmera, para a pessoa ver o que começou.
    handler.postDelayed(tick, FIRST_DELAY_MS)
    scheduleWatchdog()
    return START_STICKY
  }

  /** Fechar o app pelos recentes é onde a MIUI mais derruba serviço. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    scheduleWatchdog()
    super.onTaskRemoved(rootIntent)
  }

  /** Pede ao vigia (que mora no módulo de widgets) a próxima checagem. Vai
   * por broadcast para não criar dependência entre os dois módulos. */
  private fun scheduleWatchdog() {
    sendBroadcast(
      Intent("com.mellowpet.widget.WATCHDOG_CHECK").setPackage(packageName),
    )
  }

  private fun takeReading() {
    reader?.readOnce { reading ->
      if (reading == null) return@readOnce
      lastLabel = reading.emotion
      handler.post { refreshNotification() }
      sendBroadcast(
        Intent(ACTION_READING).apply {
          setPackage(packageName)
          putExtra(EXTRA_EMOTION, reading.emotion)
          putExtra(EXTRA_CONFIDENCE, reading.confidence)
        },
      )
      Log.d(TAG, "leitura: ${reading.emotion} (${"%.2f".format(reading.confidence)})")
    }
  }

  private fun refreshNotification() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(lastLabel))
  }

  private fun buildNotification(label: String?): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Leitura em segundo plano", NotificationManager.IMPORTANCE_LOW)
          .apply {
            description = "A cada intervalo, o Mellow lê sua expressão e fecha a câmera."
            setShowBadge(false)
          },
      )
    }

    val open = PendingIntent.getActivity(
      this,
      910,
      Intent(Intent.ACTION_VIEW, Uri.parse("mellowpet://widget/open?screen=home")).apply {
        setPackage(packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val stop = PendingIntent.getService(
      this,
      911,
      Intent(this, VisionBackgroundService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle(if (label == null) "Lendo em segundo plano" else "Mellow · $label")
      .setContentText("Uma leitura a cada $intervalMinutes min. Toque para abrir.")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentIntent(open)
      .setOngoing(true)
      .addAction(Notification.Action.Builder(null, "Parar", stop).build())
      .build()
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    reader?.release()
    reader = null
    super.onDestroy()
  }

  companion object {
    private const val TAG = "MellowVisionBg"
    private const val CHANNEL_ID = "mellowpet_vision_bg"
    private const val NOTIFICATION_ID = 4202
    private const val FIRST_DELAY_MS = 4_000L
    const val DEFAULT_INTERVAL_MIN = 15
    const val MIN_INTERVAL_MIN = 5
    const val MAX_INTERVAL_MIN = 120

    const val ACTION_STOP = "com.mellowpet.vision.STOP"
    const val ACTION_READING = "com.mellowpet.widget.VISION_READING"
    const val EXTRA_INTERVAL = "interval"
    const val EXTRA_EMOTION = "emotion"
    const val EXTRA_CONFIDENCE = "confidence"

    fun start(context: Context, intervalMinutes: Int) {
      val intent = Intent(context, VisionBackgroundService::class.java)
        .putExtra(EXTRA_INTERVAL, intervalMinutes)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, VisionBackgroundService::class.java))
    }
  }
}
