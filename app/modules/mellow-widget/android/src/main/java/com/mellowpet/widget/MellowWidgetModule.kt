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
                             moodPct: Int, petName: String, hunger: String, pets: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setMood(context, emotion, label, level, progress, moodPct, petName, hunger, pets)
      // O humor alimenta metade dos widgets (a foca, os cartões tingidos, a
      // cor da música, a frase, o plano, o próximo passo), então todos
      // precisam ser redesenhados juntos.
      MellowMoodWidgetProvider.updateAll(context)
      CareWidgetProvider.updateAll(context)
      SpotifyNowPlayingWidgetProvider.updateAll(context)
      HeroWidgetProvider.updateAll(context)
      QuoteWidgetProvider.updateAll(context)
      PlanWidgetProvider.updateAll(context)
      NextStepWidgetProvider.updateAll(context)
      BreatheWidgetProvider.updateAll(context)
      PetTapWidgetProvider.updateAll(context)
      LevelWidgetProvider.updateAll(context)
      MusicCompactWidgetProvider.updateAll(context)
    }

    // O DSL do Expo aceita no máximo 8 argumentos por função, então o painel
    // vem em duas chamadas em vez de uma só com dez listas.
    Function("updateDashboard") { wellbeing: Int, tlHours: List<String>, tlEmotions: List<String>,
                                  badges: List<Boolean>, sleep: List<Int> ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setWellbeing(context, wellbeing)
      WidgetStore.setTimeline(context, tlHours, tlEmotions)
      WidgetStore.setBadges(context, badges)
      WidgetStore.setSleep(context, sleep)
      WellbeingWidgetProvider.updateAll(context)
      TimelineWidgetProvider.updateAll(context)
      BadgesWidgetProvider.updateAll(context)
      SleepWidgetProvider.updateAll(context)
    }

    Function("updateInsights") { tgNames: List<String>, tgCounts: List<Int>,
                                 glNames: List<String>, glDone: List<Int>, glTarget: List<Int> ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setTriggers(context, tgNames, tgCounts)
      WidgetStore.setGoals(context, glNames, glDone, glTarget)
      TriggersWidgetProvider.updateAll(context)
      GoalsWidgetProvider.updateAll(context)
    }

    Function("updateCare") { names: List<String>, states: List<String>, wb: List<Int>,
                             alertTitle: String?, alertSub: String?,
                             ciWhen: String?, ciTitle: String?, ciQuestion: String? ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setPeople(context, names, states, wb)
      WidgetStore.setAlert(context, alertTitle, alertSub)
      WidgetStore.setCheckin(context, ciWhen, ciTitle, ciQuestion)
      CaregiverWidgetProvider.updateAll(context)
      CareAlertWidgetProvider.updateAll(context)
      CheckinWidgetProvider.updateAll(context)
    }

    Function("updatePlaylists") { ids: List<String>, names: List<String>, emotions: List<String> ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setPlaylists(context, ids, names, emotions)
      PlaylistsWidgetProvider.updateAll(context)
    }

    Function("updateAgenda") { dow: String?, day: String?, title: String?, sub: String? ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setAgenda(context, dow, day, title, sub)
      AgendaWidgetProvider.updateAll(context)
    }

    Function("updateDaily") { water: Int, journalTag: String, capsule: String?,
                              focusPercent: Int, focusLabel: String, focusRunning: Boolean ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetStore.setWater(context, water)
      WidgetStore.setJournalTag(context, journalTag)
      WidgetStore.setCapsule(context, capsule)
      WidgetStore.setFocus(context, focusPercent, focusLabel, focusRunning)
      WaterWidgetProvider.updateAll(context)
      JournalWidgetProvider.updateAll(context)
      CapsuleWidgetProvider.updateAll(context)
      FocusWidgetProvider.updateAll(context)
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
