package com.mellowpet.wear.sync

import android.content.Context
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/**
 * Recebe o estado que o celular empurra e guarda local.
 *
 * O Tile e as telas leem desta copia, nunca do Data Layer direto: um Tile e
 * renderizado fora do app, sem tempo para esperar rede, e um `DataClient`
 * vazio apareceria como "sem dados" em vez do ultimo valor conhecido.
 */
class PhoneStateListener : WearableListenerService() {

  override fun onDataChanged(events: DataEventBuffer) {
    for (event in events) {
      if (event.type != DataEvent.TYPE_CHANGED) continue
      val path = event.dataItem.uri.path
      val map = DataMapItem.fromDataItem(event.dataItem).dataMap

      // Tocando agora chega por caminho proprio e so toca os campos de musica:
      // reescrever o estado inteiro apagaria emocao e sequencia a cada faixa.
      if (path == PhoneLink.PATH_NOW_PLAYING) {
        StateCache.writeNowPlaying(
          this,
          map.getString("trackName")?.takeIf { it.isNotBlank() },
          map.getString("playlistName")?.takeIf { it.isNotBlank() },
          map.getBoolean("musicPlaying", false),
        )
        continue
      }
      if (path != PhoneLink.PATH_STATE) continue

      // Musica vem por outro caminho; preserva o que ja esta guardado em vez
      // de zerar a faixa a cada atualizacao de humor.
      val music = StateCache.read(this)
      StateCache.writeAll(
        this,
        PhoneState(
          emotion = map.getString("emotion") ?: "neutral",
          level = map.getInt("level", 1),
          streak = map.getInt("streak", 0),
          checkedInToday = map.getBoolean("checkedInToday", false),
          trackName = music.trackName,
          playlistName = music.playlistName,
          musicPlaying = music.musicPlaying,
          hoursSinceReading = map.getInt("hoursSinceReading", -1).takeIf { it >= 0 },
          alertTitle = map.getString("alertTitle"),
          alertDetail = map.getString("alertDetail"),
          caregiverName = map.getString("caregiverName")?.takeIf { it.isNotBlank() },
          caregiverPhone = map.getString("caregiverPhone")?.takeIf { it.isNotBlank() },
          updatedAt = System.currentTimeMillis(),
        ),
      )
    }
    StateCache.requestTileUpdate(this)
  }
}

/** Ultimo estado conhecido, em SharedPreferences. */
object StateCache {
  private const val PREFS = "mellow_wear"

  fun writeAll(context: Context, s: PhoneState) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("emotion", s.emotion)
      .putInt("level", s.level)
      .putInt("streak", s.streak)
      .putBoolean("checkedInToday", s.checkedInToday)
      .putString("trackName", s.trackName)
      .putString("playlistName", s.playlistName)
      .putBoolean("musicPlaying", s.musicPlaying)
      .putInt("hoursSinceReading", s.hoursSinceReading ?: -1)
      .putString("alertTitle", s.alertTitle)
      .putString("alertDetail", s.alertDetail)
      .putString("caregiverName", s.caregiverName)
      .putString("caregiverPhone", s.caregiverPhone)
      .putLong("updatedAt", System.currentTimeMillis())
      .apply()
  }

  fun read(context: Context): PhoneState {
    val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return PhoneState(
      emotion = p.getString("emotion", "neutral") ?: "neutral",
      level = p.getInt("level", 1),
      streak = p.getInt("streak", 0),
      checkedInToday = p.getBoolean("checkedInToday", false),
      trackName = p.getString("trackName", null),
      playlistName = p.getString("playlistName", null),
      musicPlaying = p.getBoolean("musicPlaying", false),
      hoursSinceReading = p.getInt("hoursSinceReading", -1).takeIf { it >= 0 },
      alertTitle = p.getString("alertTitle", null),
      alertDetail = p.getString("alertDetail", null),
      caregiverName = p.getString("caregiverName", null),
      caregiverPhone = p.getString("caregiverPhone", null),
      updatedAt = p.getLong("updatedAt", 0L),
    )
  }

  fun writeNowPlaying(context: Context, track: String?, playlist: String?, playing: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("trackName", track)
      .putString("playlistName", playlist)
      .putBoolean("musicPlaying", playing)
      .apply()
  }

  /** Marca que houve check-in agora sem esperar o celular confirmar — a tela
   * precisa responder na hora, e o celular corrige depois se divergir. */
  fun markCheckedIn(context: Context, emotion: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("emotion", emotion)
      .putBoolean("checkedInToday", true)
      .putInt("hoursSinceReading", 0)
      .apply()
  }

  fun requestTileUpdate(context: Context) {
    try {
      androidx.wear.tiles.TileService.getUpdater(context)
        .requestUpdate(com.mellowpet.wear.tile.MellowTileService::class.java)
    } catch (_: Exception) {
      // Tile pode nem estar adicionado ao mostrador; nao e erro.
    }
    try {
      com.mellowpet.wear.complication.MellowComplicationService.requestUpdate(context)
    } catch (_: Exception) {
      // Nenhum mostrador usando a complicacao.
    }
  }
}
