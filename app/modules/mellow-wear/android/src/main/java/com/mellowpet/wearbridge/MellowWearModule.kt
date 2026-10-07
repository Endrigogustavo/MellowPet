package com.mellowpet.wearbridge

import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte JS ↔ relogio.
 *
 * Duas direcoes, ambas assincronas por natureza do Data Layer:
 *  - `pushState` publica o estado atual para o relogio exibir;
 *  - `drainWatchCheckins` entrega ao JS o que o relogio registrou enquanto o
 *    app estava fechado.
 *
 * Nenhuma delas fala com o Supabase: a sessao e do JS, e e la que a escrita
 * acontece.
 */
class MellowWearModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MellowWear")

    /** Check-ins recebidos do relogio, como JSON. Esvazia a fila. */
    Function("drainWatchCheckins") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WatchInbox.drain(context)
    }

    /**
     * Publica o estado para o relogio. `setUrgent` porque o relogio so mostra
     * valor util se chegar agora; sem isso o sistema pode segurar a entrega por
     * minutos para poupar bateria.
     */
    Function("pushState") { emotion: String, level: Int, streak: Int, checkedInToday: Boolean ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val request = PutDataMapRequest.create(PATH_STATE).apply {
        dataMap.putString("emotion", emotion)
        dataMap.putInt("level", level)
        dataMap.putInt("streak", streak)
        dataMap.putBoolean("checkedInToday", checkedInToday)
        // O Data Layer descarta um put identico ao anterior; sem um campo que
        // sempre muda, reenviar o mesmo humor nao acordaria o relogio.
        dataMap.putLong("updatedAt", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      Wearable.getDataClient(context).putDataItem(request)
      true
    }

    /** Quantos relogios estao pareados e alcancaveis agora. */
    AsyncFunction("connectedWatches") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes -> promise.resolve(nodes.size) }
        .addOnFailureListener { promise.resolve(0) }
    }
  }

  companion object {
    const val PATH_STATE = "/mellow/state"
  }
}
