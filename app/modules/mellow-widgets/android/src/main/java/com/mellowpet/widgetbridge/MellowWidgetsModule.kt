package com.mellowpet.widgetbridge

import com.mellowpet.widget.MellowMoodWidgetProvider
import com.mellowpet.widget.RoutineWidgetProvider
import com.mellowpet.widget.SpotifyNowPlayingWidgetProvider
import com.mellowpet.widget.WidgetStore
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte JS → widgets da tela inicial. Um widget roda no processo do
 * launcher, não no do app — a única forma de ele mostrar dado atual é o app
 * escrever esse dado em algum lugar persistido (SharedPreferences) e pedir
 * pro Android redesenhar. É só isso que estas funções fazem.
 */
class MellowWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MellowWidgets")

    Function("updateMood") { emoji: String, label: String, sub: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setMood(context, emoji, label, sub)
      MellowMoodWidgetProvider.updateAll(context)
    }

    Function("updateNowPlaying") { track: String?, artist: String?, isPaused: Boolean ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setNowPlaying(context, track, artist, isPaused)
      SpotifyNowPlayingWidgetProvider.updateAll(context)
    }

    Function("updateRoutine") { time: String?, name: String? ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setRoutine(context, time, name)
      RoutineWidgetProvider.updateAll(context)
    }
  }
}
