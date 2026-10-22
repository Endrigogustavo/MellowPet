package com.mellowpet.nearby

import android.os.Handler
import android.os.Looper
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/**
 * Encontro entre pets por proximidade.
 *
 * Cada aparelho anuncia E procura ao mesmo tempo (estratégia P2P_CLUSTER:
 * todos falam com todos). Quando dois se acham, conectam, trocam um único
 * pacote pequeno — nome, espécie e estágio do pet, mais um token aleatório da
 * sessão — e desconectam. Nada de identidade da pessoa, nada de emoção.
 *
 * Os dois lados acham um ao outro quase juntos; se ambos pedissem conexão, o
 * Nearby recusaria um dos pedidos. Por isso só pede quem tem o nome de
 * endpoint "menor" — o outro só aceita.
 */
private const val SERVICE_ID = "com.mellowpet.encounter"
/** Tempo para os dois lados terminarem de trocar antes de desconectar. */
private const val LINGER_MS = 2500L

class MellowNearbyModule : Module() {

  private var client: ConnectionsClient? = null
  private var payload: ByteArray = ByteArray(0)
  /** Nome anunciado. Aleatório por sessão: não identifica a pessoa. */
  private var localName: String = ""
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("MellowNearby")
    Events("onEncounter", "onStatus")

    /** Começa a anunciar e procurar. `payloadJson` é o que o outro pet recebe. */
    Function("start") { payloadJson: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      stopInternal()
      payload = payloadJson.toByteArray(Charsets.UTF_8)
      localName = UUID.randomUUID().toString().take(8)
      val c = Nearby.getConnectionsClient(context)
      client = c

      c.startAdvertising(
        localName,
        SERVICE_ID,
        lifecycle,
        AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build(),
      ).addOnFailureListener { status("advertise_failed:${it.message}") }

      c.startDiscovery(
        SERVICE_ID,
        discovery,
        DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build(),
      ).addOnSuccessListener { status("searching") }
        .addOnFailureListener { status("discovery_failed:${it.message}") }
      true
    }

    Function("stop") {
      stopInternal()
      status("stopped")
      true
    }

    OnDestroy { stopInternal() }
  }

  private fun status(value: String) = sendEvent("onStatus", mapOf("status" to value))

  private fun stopInternal() {
    client?.apply {
      stopAdvertising()
      stopDiscovery()
      stopAllEndpoints()
    }
    client = null
  }

  private val discovery = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      if (info.serviceId != SERVICE_ID) return
      // Desempate: só um dos dois pede a conexão.
      if (localName < info.endpointName) {
        client?.requestConnection(localName, endpointId, lifecycle)
      }
    }

    override fun onEndpointLost(endpointId: String) = Unit
  }

  private val payloads = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, received: Payload) {
      val bytes = received.asBytes() ?: return
      // Limite de tamanho: o pacote legítimo tem poucas dezenas de bytes.
      if (bytes.size > 1024) return
      sendEvent("onEncounter", mapOf("payload" to String(bytes, Charsets.UTF_8)))
      main.postDelayed({ client?.disconnectFromEndpoint(endpointId) }, LINGER_MS)
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
  }

  private val lifecycle = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      // Aceite automático: o que trafega é só o cartão do pet, sem nada
      // sensível, e o encontro tem de acontecer sem a pessoa parar o que faz.
      client?.acceptConnection(endpointId, payloads)
    }

    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      if (resolution.status.statusCode == ConnectionsStatusCodes.STATUS_OK) {
        client?.sendPayload(endpointId, Payload.fromBytes(payload))
      }
    }

    override fun onDisconnected(endpointId: String) = Unit
  }
}
