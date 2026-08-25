package com.mellowpet.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Todo botão de widget abre o app via deep link `mellowpet://widget/...` em
 * vez de agir sozinho — o widget roda no processo do launcher, sem acesso ao
 * App Remote do Spotify nem à sessão do Supabase; só o app (já rodando ou
 * recém-aberto) tem os dois. `singleTask` no manifest evita empilhar telas.
 */
internal object WidgetIntents {
  fun openApp(context: Context, requestCode: Int, path: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("mellowpet://widget/$path")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /**
   * Ação executada no lugar, sem abrir o app — ver WidgetActionReceiver.
   * É o que faz pausar a música ou registrar um copo d'água responder
   * dentro do próprio widget.
   */
  fun action(context: Context, requestCode: Int, action: String, value: String? = null): PendingIntent {
    val intent = Intent(context, WidgetActionReceiver::class.java).apply {
      this.action = action
      if (value != null) putExtra(WidgetActionReceiver.EXTRA_VALUE, value)
    }
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
