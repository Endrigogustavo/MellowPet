package com.mellowpet.nearby

import android.os.Handler
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
import android.os.Looper
import android.util.Log
import com.google.android.gms.common.api.ApiException
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
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
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
/** Pedido de conexão que falhou (rádio ocupado, os dois pediram juntos…) é refeito. */
private const val RETRY_MS = 3000L
private const val MAX_RETRIES = 4
private const val TAG = "MellowNearby"

class MellowNearbyModule : Module() {

  private var client: ConnectionsClient? = null
  private var payload: ByteArray = ByteArray(0)
  /** Nome anunciado. Aleatório por sessão: não identifica a pessoa. */
  private var localName: String = ""
  private val main = Handler(Looper.getMainLooper())
  /** Tentativas por endpoint achado; some quando a troca termina ou ele some. */
  private val attempts = HashMap<String, Int>()

  override fun definition() = ModuleDefinition {
    Name("MellowNearby")
    Events("onEncounter", "onStatus")

    /** Começa a anunciar e procurar. `payloadJson` é o que o outro pet recebe. */
    Function("start") { payloadJson: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      stopInternal()
      payload = payloadJson.toByteArray(Charsets.UTF_8)
      // NFC: o mesmo cartão vale para quem encostar (até 250 bytes, cabe numa APDU).
      NfcCards.ownCard = payload.takeIf { it.size <= 250 }
      NfcCards.onReceived = { card -> received(card, "nfc") }
      localName = UUID.randomUUID().toString().take(8)
      val c = Nearby.getConnectionsClient(context)
      client = c

      c.startAdvertising(
        localName,
        SERVICE_ID,
        lifecycle,
        AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build(),
      ).addOnSuccessListener { Log.i(TAG, "anunciando como $localName") }
        .addOnFailureListener { status("advertise_failed:${code(it)}") }

      c.startDiscovery(
        SERVICE_ID,
        discovery,
        DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build(),
      ).addOnSuccessListener { status("searching") }
        .addOnFailureListener { status("discovery_failed:${code(it)}") }
      true
    }

    /** Só o NFC (sem Bluetooth/Wi-Fi): não depende de permissão de localização. */
    Function("startNfc") { payloadJson: String ->
      payload = payloadJson.toByteArray(Charsets.UTF_8)
      NfcCards.ownCard = payload.takeIf { it.size <= 250 }
      NfcCards.onReceived = { card -> received(card, "nfc") }
      true
    }

    /** "ok", "disabled" (NFC desligado nas configurações) ou "none" (sem NFC/HCE). */
    Function("nfcStatus") {
      val context = appContext.reactContext ?: return@Function "none"
      val adapter = NfcAdapter.getDefaultAdapter(context) ?: return@Function "none"
      if (!context.packageManager.hasSystemFeature("android.hardware.nfc.hce")) return@Function "none"
      if (adapter.isEnabled) "ok" else "disabled"
    }

    /**
     * Modo leitor por até 30 s: ao encostar no outro celular (com o MellowPet
     * aberto), manda o nosso cartão e recebe o dele. Resolve true se trocou.
     */
    AsyncFunction("nfcTap") { promise: Promise ->
      val activity = appContext.currentActivity
      val adapter = activity?.let { NfcAdapter.getDefaultAdapter(it) }
      val card = NfcCards.ownCard
      if (activity == null || adapter == null || !adapter.isEnabled || card == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      var done = false
      val finish = { ok: Boolean ->
        if (!done) {
          done = true
          main.post { try { adapter.disableReaderMode(activity) } catch (_: Exception) {} }
          promise.resolve(ok)
        }
      }
      adapter.enableReaderMode(
        activity,
        { tag ->
          val iso = IsoDep.get(tag)
          if (iso == null) return@enableReaderMode
          try {
            iso.connect()
            iso.timeout = 3000
            val aid = PetCardApduService.AID
            val select = byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, aid.size.toByte()) + aid
            val sel = iso.transceive(select)
            if (!sel.endsWithOk()) return@enableReaderMode
            val exchange = byteArrayOf(0x80.toByte(), PetCardApduService.INS_EXCHANGE, 0x00, 0x00, card.size.toByte()) + card + byteArrayOf(0x00)
            val res = iso.transceive(exchange)
            if (res.endsWithOk() && res.size > 2) {
              received(String(res, 0, res.size - 2, Charsets.UTF_8), "nfc")
              finish(true)
            }
          } catch (e: Exception) {
            Log.w(TAG, "NFC: falhou a troca (${e.message}); tente encostar de novo")
          } finally {
            try { iso.close() } catch (_: Exception) {}
          }
        },
        NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
        null,
      )
      status("nfc_waiting")
      main.postDelayed({ finish(false) }, 30_000)
    }.runOnQueue(Queues.MAIN)

    Function("stop") {
      stopInternal()
      status("stopped")
      true
    }

    OnDestroy { stopInternal() }
  }

  private fun status(value: String) {
    Log.i(TAG, value)
    sendEvent("onStatus", mapOf("status" to value))
  }

  /** Código numérico do Nearby (ex.: 8034 = falta permissão) ou a mensagem. */
  private fun code(e: Exception): String =
    if (e is ApiException) "${e.statusCode}" else (e.message ?: "erro")

  private fun request(endpointId: String) {
    val c = client ?: return
    val tries = attempts[endpointId] ?: return
    c.requestConnection(localName, endpointId, lifecycle)
      .addOnSuccessListener { Log.i(TAG, "pedido de conexão enviado a $endpointId") }
      .addOnFailureListener { e ->
        val failed = code(e)
        // 8003 = já conectado: a troca segue pelo caminho normal.
        if (failed == "${ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT}") return@addOnFailureListener
        if (tries + 1 >= MAX_RETRIES) {
          attempts.remove(endpointId)
          status("connect_failed:$failed")
          return@addOnFailureListener
        }
        attempts[endpointId] = tries + 1
        Log.w(TAG, "conexão com $endpointId falhou ($failed); tentando de novo")
        main.postDelayed({ request(endpointId) }, RETRY_MS)
      }
  }

  private fun ByteArray.endsWithOk() =
    size >= 2 && this[size - 2] == 0x90.toByte() && this[size - 1] == 0x00.toByte()

  /** Cartão recebido por qualquer meio (proximidade ou NFC). */
  private fun received(card: String, via: String) {
    if (card.toByteArray(Charsets.UTF_8).size > 1024) return
    status("exchanged")
    Log.i(TAG, "cartão recebido via $via")
    sendEvent("onEncounter", mapOf("payload" to card))
  }

  private fun stopInternal() {
    NfcCards.ownCard = null
    NfcCards.onReceived = null
    main.removeCallbacksAndMessages(null)
    attempts.clear()
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
      status("found")
      // Desempate: só um dos dois pede a conexão. O outro espera o pedido.
      if (localName < info.endpointName && !attempts.containsKey(endpointId)) {
        attempts[endpointId] = 0
        request(endpointId)
      }
    }

    override fun onEndpointLost(endpointId: String) {
      attempts.remove(endpointId)
    }
  }

  private val payloads = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, received: Payload) {
      val bytes = received.asBytes() ?: return
      // Limite de tamanho: o pacote legítimo tem poucas dezenas de bytes.
      if (bytes.size > 1024) return
      attempts.remove(endpointId)
      received(String(bytes, Charsets.UTF_8), "nearby")
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
        status("connected")
        client?.sendPayload(endpointId, Payload.fromBytes(payload))
      } else {
        Log.w(TAG, "conexão recusada/falhou: ${resolution.status.statusCode}")
      }
    }

    override fun onDisconnected(endpointId: String) = Unit
  }
}
