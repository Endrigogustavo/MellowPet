package com.mellowpet.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Vigia dos serviços de segundo plano.
 *
 * Acorda por alarme periódico, no boot e quando o app é removido dos
 * recentes — os três momentos em que uma ROM agressiva costuma derrubar o
 * serviço sem reiniciá-lo. Reergue o que a pessoa deixou ligado e agenda a
 * próxima checagem.
 *
 * Iniciar um serviço já rodando é inofensivo: cai em `onStartCommand` de
 * novo e nada além disso.
 */
class ServiceWatchdogReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_CHECK,
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      "android.intent.action.QUICKBOOT_POWERON",
      "com.htc.intent.action.QUICKBOOT_POWERON",
      -> ServiceGuard.restoreEnabled(context)
    }
  }

  companion object {
    const val ACTION_CHECK = "com.mellowpet.widget.WATCHDOG_CHECK"
  }
}
