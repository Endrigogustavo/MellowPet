package com.mellowpet.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Mantém os serviços de segundo plano vivos em ROMs que os matam.
 *
 * `START_STICKY` é a promessa do Android de reiniciar um serviço morto —
 * mas fabricantes como Xiaomi/MIUI simplesmente não a cumprem: matam o
 * processo e nunca o trazem de volta. Aqui vale a regra "confie, mas
 * verifique": um alarme periódico acorda e reergue o que deveria estar
 * rodando.
 *
 * O alarme é reagendado a cada disparo (em vez de repeating) porque só
 * `setExactAndAllowWhileIdle` fura o Doze, e ele é sempre de disparo único.
 */
internal object ServiceGuard {
  private const val TAG = "MellowGuard"
  private const val PREFS = "mellow_widget_prefs"
  private const val REQUEST = 990

  /** Intervalo de verificação. 15 min é o menor valor que o Android aceita
   * sem tratar como abuso — abaixo disso ele agrupa os alarmes de qualquer
   * jeito. */
  private const val CHECK_INTERVAL_MS = 15 * 60 * 1000L

  const val VISION_SERVICE = "com.mellowpet.vision.VisionBackgroundService"

  fun scheduleNextCheck(context: Context) {
    val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val pending = PendingIntent.getBroadcast(
      context,
      REQUEST,
      Intent(context, ServiceWatchdogReceiver::class.java)
        .setAction(ServiceWatchdogReceiver.ACTION_CHECK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val at = System.currentTimeMillis() + CHECK_INTERVAL_MS
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        // ...AllowWhileIdle é o que faz o alarme disparar mesmo com o
        // aparelho parado há horas.
        alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
      } else {
        alarm.setExact(AlarmManager.RTC_WAKEUP, at, pending)
      }
    } catch (e: SecurityException) {
      // Android 12+ pode exigir permissão para alarme exato; cair para um
      // alarme inexato é melhor que não ter vigia nenhum.
      Log.w(TAG, "sem permissão de alarme exato, usando inexato", e)
      alarm.set(AlarmManager.RTC_WAKEUP, at, pending)
    }
  }

  fun cancelCheck(context: Context) {
    val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    alarm.cancel(
      PendingIntent.getBroadcast(
        context,
        REQUEST,
        Intent(context, ServiceWatchdogReceiver::class.java)
          .setAction(ServiceWatchdogReceiver.ACTION_CHECK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      ),
    )
  }

  /** Reergue o que a pessoa deixou ligado. Chamado pelo vigia e no boot. */
  fun restoreEnabled(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    if (prefs.getBoolean("bg_enabled", false)) {
      startService(context, Intent(context, MellowBackgroundService::class.java))
    }

    if (prefs.getBoolean("vision_bg_enabled", false)) {
      // Componente por nome: este módulo não conhece o de visão em tempo de
      // compilação, e criar a dependência entre os dois só por isto não se
      // paga.
      val intent = Intent().apply {
        component = ComponentName(context.packageName, VISION_SERVICE)
        putExtra("interval", prefs.getInt("vision_bg_interval", 15))
      }
      startService(context, intent)
    }

    scheduleNextCheck(context)
  }

  private fun startService(context: Context, intent: Intent) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    } catch (e: Exception) {
      // Em Android 12+ um app em segundo plano nem sempre pode iniciar
      // serviço em primeiro plano. Falhar aqui é aceitável — o próximo
      // alarme tenta de novo, e o app reergue tudo ao ser aberto.
      Log.w(TAG, "não foi possível iniciar ${intent.component?.className}", e)
    }
  }
}
