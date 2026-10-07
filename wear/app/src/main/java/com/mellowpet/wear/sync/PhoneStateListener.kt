package com.mellowpet.wear.sync

import android.content.Context
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/**
 * Recebe o estado que o celular empurra e guarda local.
 *
 * O Tile e a tela leem desta copia, nunca do Data Layer direto: um Tile e
 * renderizado fora do app, sem tempo para esperar rede, e um `DataClient`
 * vazio apareceria como "sem dados" em vez do ultimo valor conhecido.
 */
class PhoneStateListener : WearableListenerService() {

  override fun onDataChanged(events: DataEventBuffer) {
    for (event in events) {
      if (event.type != DataEvent.TYPE_CHANGED) continue
      if (event.dataItem.uri.path != PhoneLink.PATH_STATE) continue
      val map = DataMapItem.fromDataItem(event.dataItem).dataMap
      StateCache.write(
        this,
        emotion = map.getString("emotion") ?: "neutral",
        level = map.getInt("level", 1),
        streak = map.getInt("streak", 0),
        checkedInToday = map.getBoolean("checkedInToday", false),
      )
    }
    // Chegou estado novo = o celular esta alcancavel agora. Bom momento para
    // escoar check-ins que ficaram presos na fila.
    StateCache.requestTileUpdate(this)
  }
}

/** Ultimo estado conhecido, em SharedPreferences. */
object StateCache {
  private const val PREFS = "mellow_wear"

  fun write(context: Context, emotion: String, level: Int, streak: Int, checkedInToday: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("emotion", emotion)
      .putInt("level", level)
      .putInt("streak", streak)
      .putBoolean("checkedInToday", checkedInToday)
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
      updatedAt = p.getLong("updatedAt", 0L),
    )
  }

  /** Marca que houve check-in hoje sem esperar o celular confirmar — a tela
   * precisa responder na hora, e o celular corrige depois se divergir. */
  fun markCheckedIn(context: Context, emotion: String) {
    val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    p.edit().putString("emotion", emotion).putBoolean("checkedInToday", true).apply()
  }

  fun requestTileUpdate(context: Context) {
    try {
      androidx.wear.tiles.TileService.getUpdater(context)
        .requestUpdate(com.mellowpet.wear.tile.MellowTileService::class.java)
    } catch (_: Exception) {
      // Tile pode nem estar adicionado ao mostrador; nao e erro.
    }
  }
}
