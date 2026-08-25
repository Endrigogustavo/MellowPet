package com.mellowpet.widget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder

/**
 * Mantém o MellowPet vivo com o app fechado.
 *
 * O que ele faz: segura o processo de pé para que os widgets respondam na
 * hora (registrar sentimento, água, carinho, controlar a música) sem o
 * Android matar o app entre um toque e outro, e mantém a leitura mais
 * recente à mão na notificação.
 *
 * O que ele NÃO faz: ligar a câmera. Desde o Android 9 um app em segundo
 * plano não tem acesso à câmera, e mesmo com serviço em primeiro plano
 * manter a câmera aberta o dia todo drenaria a bateria e deixaria o LED
 * aceso — num app de bem-estar isso é intrusivo demais para ser padrão.
 * A leitura facial continua acontecendo quando o app está aberto; aqui só
 * mora o que a pessoa registrou e o que o app já calculou.
 *
 * Por isso a notificação é honesta sobre o estado: ela diz o último
 * sentimento conhecido, não finge que está lendo agora.
 */
class MellowBackgroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    startForeground(NOTIFICATION_ID, buildNotification())
    // START_STICKY: se o sistema matar por pressão de memória, volta sozinho
    // — é o ponto todo de ficar em segundo plano.
    return START_STICKY
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "MellowPet ativo",
        // LOW: presença silenciosa. Isto não é um alerta, é um estado.
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Mantém os widgets funcionando com o app fechado."
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }

    val mood = WidgetStore.getMood(this)
    val open = PendingIntent.getActivity(
      this,
      900,
      Intent(Intent.ACTION_VIEW, Uri.parse("mellowpet://widget/open?screen=home")).apply {
        setPackage(packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val stop = PendingIntent.getService(
      this,
      901,
      Intent(this, MellowBackgroundService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("Mellow · ${mood.label}")
      .setContentText("Nível ${mood.level} · widgets ativos")
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentIntent(open)
      .setOngoing(true)
      .addAction(Notification.Action.Builder(null, "Parar", stop).build())
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "mellowpet_background"
    private const val NOTIFICATION_ID = 4201
    const val ACTION_STOP = "com.mellowpet.widget.STOP_BACKGROUND"

    fun start(context: Context) {
      val intent = Intent(context, MellowBackgroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, MellowBackgroundService::class.java))
    }
  }
}
