package com.mellowpet.spotify

import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.PlayerState
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Controle remoto do app Spotify instalado no aparelho, via App Remote SDK.
 * O audio toca dentro do proprio app Spotify (ou via Spotify Connect) — este
 * modulo so manda comandos e recebe o estado do player, nunca lida com audio
 * em si. Exige o app Spotify instalado e, para tocar musica alem de trechos
 * curtos, conta Premium (restricao da propria Spotify, nao deste codigo).
 */
class MellowSpotifyModule : Module() {
  private var remote: SpotifyAppRemote? = null
  private var playerStateSubscription: Subscription<PlayerState>? = null

  override fun definition() = ModuleDefinition {
    Name("MellowSpotify")

    Events("onPlayerStateChanged", "onConnectionChanged")

    Function("isSpotifyInstalled") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SpotifyAppRemote.isSpotifyInstalled(context)
    }

    Function("isConnected") {
      remote?.isConnected == true
    }

    AsyncFunction("connect") { clientId: String, redirectUri: String, promise: Promise ->
      if (remote?.isConnected == true) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("no_context", "Contexto do app indisponivel.", null)
        return@AsyncFunction
      }
      val params = ConnectionParams.Builder(clientId)
        .setRedirectUri(redirectUri)
        .showAuthView(true)
        .build()
      SpotifyAppRemote.connect(
        context,
        params,
        object : Connector.ConnectionListener {
          override fun onConnected(appRemote: SpotifyAppRemote) {
            remote = appRemote
            subscribeToPlayerState(appRemote)
            sendEvent("onConnectionChanged", mapOf("connected" to true, "error" to null))
            promise.resolve(true)
          }

          override fun onFailure(error: Throwable) {
            val message = error.message ?: "Falha ao conectar ao Spotify."
            sendEvent("onConnectionChanged", mapOf("connected" to false, "error" to message))
            promise.reject("connect_failed", message, error)
          }
        },
      )
    }

    AsyncFunction("disconnect") {
      playerStateSubscription?.cancel()
      playerStateSubscription = null
      remote?.let { SpotifyAppRemote.disconnect(it) }
      remote = null
      sendEvent("onConnectionChanged", mapOf("connected" to false, "error" to null))
    }

    AsyncFunction("play") { uri: String, promise: Promise ->
      val api = remote?.playerApi
      if (api == null) {
        promise.reject("not_connected", "Spotify não conectado.", null)
        return@AsyncFunction
      }
      api.play(uri)
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.reject("play_failed", it.message ?: "Falha ao tocar.", it) }
    }

    // Enfileira uma faixa depois da atual. Serve para tocar uma playlist do
    // MellowPet que nao foi espelhada na conta do Spotify: sem isto, play()
    // da primeira faixa tocaria so ela e o player pararia.
    AsyncFunction("queue") { uri: String, promise: Promise ->
      val api = remote?.playerApi
      if (api == null) {
        promise.reject("not_connected", "Spotify não conectado.", null)
        return@AsyncFunction
      }
      api.queue(uri)
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.reject("queue_failed", it.message ?: "Falha ao enfileirar.", it) }
    }

    AsyncFunction("pause") { promise: Promise ->
      val api = remote?.playerApi
      if (api == null) {
        promise.reject("not_connected", "Spotify não conectado.", null)
        return@AsyncFunction
      }
      api.pause()
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.reject("pause_failed", it.message ?: "Falha ao pausar.", it) }
    }

    AsyncFunction("resume") { promise: Promise ->
      val api = remote?.playerApi
      if (api == null) {
        promise.reject("not_connected", "Spotify não conectado.", null)
        return@AsyncFunction
      }
      api.resume()
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.reject("resume_failed", it.message ?: "Falha ao retomar.", it) }
    }

    AsyncFunction("skipNext") { promise: Promise ->
      val api = remote?.playerApi
      if (api == null) {
        promise.reject("not_connected", "Spotify não conectado.", null)
        return@AsyncFunction
      }
      api.skipNext()
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.reject("skip_failed", it.message ?: "Falha ao pular.", it) }
    }

    AsyncFunction("skipPrevious") { promise: Promise ->
      val api = remote?.playerApi
      if (api == null) {
        promise.reject("not_connected", "Spotify não conectado.", null)
        return@AsyncFunction
      }
      api.skipPrevious()
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.reject("skip_failed", it.message ?: "Falha ao voltar.", it) }
    }

    OnDestroy {
      playerStateSubscription?.cancel()
      remote?.let { SpotifyAppRemote.disconnect(it) }
      remote = null
    }
  }

  private fun subscribeToPlayerState(appRemote: SpotifyAppRemote) {
    playerStateSubscription?.cancel()
    playerStateSubscription = appRemote.playerApi.subscribeToPlayerState()
      .setEventCallback { state ->
        sendEvent(
          "onPlayerStateChanged",
          mapOf(
            "trackName" to state.track?.name,
            "artistName" to state.track?.artist?.name,
            "trackUri" to state.track?.uri,
            "isPaused" to state.isPaused,
            "positionMs" to state.playbackPosition,
            "durationMs" to (state.track?.duration ?: 0L),
          ),
        )
      }
  }
}
