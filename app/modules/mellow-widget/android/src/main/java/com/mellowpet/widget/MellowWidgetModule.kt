package com.mellowpet.widget

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte JS → widgets da tela inicial. Um widget roda no processo do
 * launcher, não no do app — a única forma de ele mostrar dado atual é o app
 * escrever esse dado em algum lugar persistido (ver WidgetStore) e pedir pro
 * Android redesenhar. É só isso que estas funções fazem.
 */
class MellowWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MellowWidget")

    Function("updateMood") { emotion: String, label: String, level: Int, progress: Int,
                             moodPct: Int, petName: String, hunger: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setMood(context, emotion, label, level, progress, moodPct, petName, hunger)
      // O humor tinge três widgets diferentes (a foca, o card de cuidar e a
      // cor do card de música), então todos precisam ser redesenhados juntos.
      MellowMoodWidgetProvider.updateAll(context)
      CareWidgetProvider.updateAll(context)
      SpotifyNowPlayingWidgetProvider.updateAll(context)
    }

    Function("updateNowPlaying") { track: String?, artist: String?, isPaused: Boolean,
                                   source: String, progress: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setNowPlaying(context, track, artist, isPaused, source, progress)
      SpotifyNowPlayingWidgetProvider.updateAll(context)
    }

    Function("updateRoutine") { times: List<String>, names: List<String>, states: List<String> ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val items = times.indices.take(3).map { i ->
        WidgetStore.RoutineItem(
          times[i],
          names.getOrElse(i) { "" },
          states.getOrElse(i) { "todo" },
        )
      }
      WidgetStore.setRoutine(context, items)
      RoutineWidgetProvider.updateAll(context)
    }

    Function("updateStreak") { days: Int, week: List<Boolean> ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setStreak(context, days, week)
      StreakWidgetProvider.updateAll(context)
    }
  }
}
