package com.mellowpet.wear.health

import android.content.Context
import androidx.health.services.client.HealthServices
import androidx.health.services.client.MeasureCallback
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.DeltaDataType
import androidx.concurrent.futures.await
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Frequencia cardiaca durante o check-in.
 *
 * Usa `MeasureClient`, que liga o sensor so enquanto alguem esta ouvindo —
 * nao e monitoramento continuo. Isso e deliberado: ligar o sensor o dia todo
 * gasta bateria e cria um registro de corpo bem mais invasivo do que o que
 * este app precisa. O numero serve como contexto de UM check-in.
 *
 * Importante para a leitura dos dados: batimento NAO e emocao. Frequencia alta
 * pode ser cafe, escada ou susto. O app mostra o numero junto do que a pessoa
 * declarou e nao conclui nada sozinho.
 */
object HeartRate {

  sealed interface Reading {
    /** Sensor aquecendo ou pulso sem contato com a pele. */
    data object Waiting : Reading
    data class Bpm(val value: Int) : Reading
    /** Sem sensor, sem permissao, ou o aparelho nao expoe HR. */
    data object Unavailable : Reading
  }

  /** `true` se o aparelho mede HR. Galaxy Watch 4 mede; um emulador nao. */
  suspend fun isSupported(context: Context): Boolean = try {
    val caps = HealthServices.getClient(context).measureClient.getCapabilitiesAsync().await()
    DataType.HEART_RATE_BPM in caps.supportedDataTypesMeasure
  } catch (_: Exception) {
    false
  }

  /**
   * Emite leituras enquanto houver coletor. Fecha o sensor ao cancelar o fluxo
   * — sem isso o sensor fica ligado depois da tela sair.
   */
  fun stream(context: Context): Flow<Reading> = callbackFlow {
    val client = HealthServices.getClient(context).measureClient
    val type: DeltaDataType<Double, *> = DataType.HEART_RATE_BPM

    val callback = object : MeasureCallback {
      override fun onAvailabilityChanged(
        dataType: DeltaDataType<*, *>,
        availability: Availability,
      ) {
        if (availability is androidx.health.services.client.data.DataTypeAvailability &&
          availability != androidx.health.services.client.data.DataTypeAvailability.AVAILABLE
        ) {
          trySend(Reading.Waiting)
        }
      }

      override fun onDataReceived(data: DataPointContainer) {
        val bpm = data.getData(DataType.HEART_RATE_BPM).lastOrNull()?.value ?: return
        // 0 aparece enquanto o sensor ainda nao pegou o pulso.
        if (bpm > 0) trySend(Reading.Bpm(bpm.toInt()))
      }
    }

    try {
      client.registerMeasureCallback(type, callback)
    } catch (_: Exception) {
      trySend(Reading.Unavailable)
      close()
      return@callbackFlow
    }

    awaitClose {
      try {
        client.unregisterMeasureCallbackAsync(type, callback)
      } catch (_: Exception) {
        // Encerrando de qualquer forma; nao ha o que recuperar aqui.
      }
    }
  }
}
