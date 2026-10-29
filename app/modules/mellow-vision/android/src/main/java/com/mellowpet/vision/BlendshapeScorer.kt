package com.mellowpet.vision

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * Porte Kotlin de `scoreBlendshapes` em src/vision/expressionEngine.ts.
 *
 * Existe porque a leitura em segundo plano roda inteira em Kotlin — não há
 * bridge de JS num serviço sem a UI montada. Os pesos são idênticos aos do
 * TypeScript de propósito: uma leitura feita com o app fechado precisa dar
 * o mesmo resultado que a mesma cara daria com o app aberto. Se um dia os
 * pesos mudarem lá, precisam mudar aqui junto.
 */
internal object BlendshapeScorer {

  val EXPRESSIONS = listOf("happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful")

  private fun clip(v: Double) = v.coerceIn(0.0, 1.0)

  private fun value(src: Map<String, Double>, vararg names: String): Double =
    names.map { clip(src[it] ?: 0.0) }.average()

  private fun activate(input: Double, onset: Double = 0.04, saturation: Double = 0.72): Double {
    val scaled = clip((input - onset) / max(0.01, saturation - onset))
    return scaled * scaled * (3 - 2 * scaled)
  }

  private fun bilateral(
    src: Map<String, Double>,
    left: String,
    right: String,
    onset: Double = 0.04,
    saturation: Double = 0.72,
    symmetryWeight: Double = 0.2,
  ): Double {
    val l = activate(value(src, left), onset, saturation)
    val r = activate(value(src, right), onset, saturation)
    val mean = (l + r) / 2
    val symmetry = 1 - abs(l - r)
    return clip(mean * (1 - symmetryWeight + symmetryWeight * symmetry))
  }

  /** Distribuição normalizada sobre as sete classes. */
  fun score(src: Map<String, Double>): Map<String, Double> {
    val browInner = activate(value(src, "browInnerUp"), 0.055, 0.52)
    val browOuterLeft = activate(value(src, "browOuterUpLeft"), 0.03, 0.54)
    val browOuterRight = activate(value(src, "browOuterUpRight"), 0.03, 0.54)
    val browOuter = bilateral(src, "browOuterUpLeft", "browOuterUpRight", 0.03, 0.54)
    val browDownLeft = activate(value(src, "browDownLeft"), 0.03, 0.52)
    val browDownRight = activate(value(src, "browDownRight"), 0.03, 0.52)
    val browDown = bilateral(src, "browDownLeft", "browDownRight", 0.03, 0.52, 0.1)
    val browDownPeak = max(browDownLeft, browDownRight)
    val browArchAsym = clip(
      abs(browOuterLeft - browOuterRight) * 0.85 + abs(browDownLeft - browDownRight) * 0.65,
    )
    val cheekRaise = bilateral(src, "cheekSquintLeft", "cheekSquintRight", 0.035, 0.6, 0.16)
    val noseWrinkle = bilateral(src, "noseSneerLeft", "noseSneerRight", 0.03, 0.42, 0.1)
    val leftSmile = activate(value(src, "mouthSmileLeft"), 0.035, 0.56)
    val rightSmile = activate(value(src, "mouthSmileRight"), 0.035, 0.56)
    val smileConcordance = clip(
      min(leftSmile, rightSmile) / max(0.05, 0.25 * max(leftSmile, rightSmile)),
    )
    val smile = bilateral(src, "mouthSmileLeft", "mouthSmileRight", 0.035, 0.56, 0.22) *
      (0.25 + 0.75 * smileConcordance)
    val frown = bilateral(src, "mouthFrownLeft", "mouthFrownRight", 0.045, 0.52, 0.18)
    val mouthStretch = bilateral(src, "mouthStretchLeft", "mouthStretchRight", 0.04, 0.58, 0.12)
    val jawOpen = activate(value(src, "jawOpen"), 0.04, 0.6)
    val eyesClosed = bilateral(src, "eyeBlinkLeft", "eyeBlinkRight", 0.08, 0.62, 0.08)
    val eyeWide = bilateral(src, "eyeWideLeft", "eyeWideRight", 0.03, 0.55, 0.14)
    val eyeSquint = bilateral(src, "eyeSquintLeft", "eyeSquintRight", 0.04, 0.58, 0.12)
    val mouthPress = bilateral(src, "mouthPressLeft", "mouthPressRight", 0.04, 0.58, 0.12)
    val mouthPucker = activate(value(src, "mouthPucker"), 0.03, 0.45)
    val mouthRoll = bilateral(src, "mouthRollLower", "mouthRollUpper", 0.04, 0.6, 0.0)
    val mouthShrug = bilateral(src, "mouthShrugLower", "mouthShrugUpper", 0.04, 0.6, 0.0)
    val mouthLower = bilateral(src, "mouthLowerDownLeft", "mouthLowerDownRight", 0.035, 0.58, 0.12)
    val mouthUpper = bilateral(src, "mouthUpperUpLeft", "mouthUpperUpRight", 0.03, 0.42, 0.12)
    val dimple = bilateral(src, "mouthDimpleLeft", "mouthDimpleRight", 0.045, 0.7, 0.2)
    val jawLateral = activate(value(src, "jawLeft", "jawRight"), 0.04, 0.6)

    val laughSynergy = min(
      smile,
      0.6 * jawOpen + 0.45 * eyesClosed + 0.45 * cheekRaise,
    )
    val happy = max(
      0.0,
      0.52 * smile + 0.18 * cheekRaise + 0.11 * dimple + 0.08 * eyeSquint +
        0.18 * min(smile, max(cheekRaise, dimple)) + 0.22 * laughSynergy -
        0.24 * browDown - 0.22 * frown - 0.16 * mouthPress -
        0.12 * noseWrinkle * (1 - 0.5 * cheekRaise),
    )

    // Tristeza quieta e tristeza de choro ativam AUs bem diferentes.
    val sadCore = max(frown, 0.85 * browInner)
    val cryingGate = (1 - 0.85 * smile) * (0.08 + 0.92 * min(1.0, 1.35 * sadCore))
    val quietSad = 0.34 * frown + 0.24 * browInner + 0.12 * mouthLower + 0.07 * mouthPress +
      0.06 * mouthRoll + 0.24 * min(frown, browInner)
    val cryingSad = (0.3 * eyesClosed + 0.22 * jawOpen + 0.18 * browInner + 0.1 * mouthStretch +
      0.2 * min(eyesClosed, jawOpen)) * cryingGate
    val sad = max(
      0.0,
      max(quietSad, cryingSad) + 0.1 * min(quietSad, cryingSad) -
        0.45 * smile - 0.24 * cheekRaise - 0.12 * eyeWide - 0.08 * noseWrinkle -
        0.28 * browDown * (1 - 0.8 * eyesClosed) - 0.14 * eyeSquint * (1 - 0.8 * eyesClosed),
    )

    val glareOrTension = max(
      eyeSquint,
      max(
        0.85 * browDownPeak,
        max(0.8 * mouthPress, max(0.75 * noseWrinkle, max(0.7 * frown, 0.65 * mouthUpper))),
      ),
    )
    val browArchPeak = max(browOuterLeft, max(browOuterRight, browInner))
    val angryBrowArch = clip(
      0.55 * browArchAsym +
        0.55 * min(browArchPeak, glareOrTension) +
        0.35 * min(browDownPeak, browArchPeak),
    ) * (1 - 0.85 * eyeWide) * (1 - 0.85 * smile) * (1 - 0.7 * jawOpen)
    val cryingPenalty = min(eyesClosed, max(jawOpen, 0.8 * browInner))
    val surpriseFearBrowPenalty = min(max(browInner, browOuter), eyeWide)
    val angry = max(
      0.0,
      0.38 * browDown + 0.22 * mouthPress + 0.17 * noseWrinkle + 0.12 * eyeSquint +
        0.08 * frown + 0.06 * mouthUpper + 0.06 * mouthStretch + 0.04 * jawLateral + 0.03 * mouthRoll +
        0.16 * min(browDownPeak, max(mouthPress, max(noseWrinkle, max(eyeSquint, frown)))) +
        0.28 * angryBrowArch -
        0.28 * smile - 0.16 * cheekRaise - 0.14 * eyeWide -
        0.38 * cryingPenalty - 0.22 * surpriseFearBrowPenalty -
        0.12 * min(noseWrinkle, min(mouthUpper, mouthPucker)) -
        0.12 * eyesClosed * (1 - browDownPeak),
    )

    val surprised = max(
      0.0,
      0.25 * jawOpen + 0.22 * eyeWide + 0.18 * browOuter + 0.13 * browInner +
        0.22 * min(eyeWide, max(jawOpen, browOuter)) - 0.24 * eyesClosed -
        0.16 * browDown - 0.12 * mouthPress - 0.08 * noseWrinkle,
    )

    val mouthTension = clip(0.55 * mouthStretch + 0.3 * mouthPress + 0.15 * browDown)
    val fearful = max(
      0.0,
      0.26 * eyeWide + 0.22 * mouthStretch + 0.2 * browInner + 0.12 * browOuter +
        0.09 * browDown + 0.06 * mouthPress + 0.12 * mouthTension +
        0.18 * min(eyeWide, min(mouthStretch, max(browInner, browOuter))) -
        0.2 * smile - 0.1 * cheekRaise - 0.1 * noseWrinkle - 0.06 * jawOpen,
    )

    val disgusted = max(
      0.0,
      0.44 * noseWrinkle + 0.26 * mouthUpper + 0.13 * mouthPucker + 0.1 * frown +
        0.08 * browDown + 0.05 * mouthShrug + 0.03 * jawLateral +
        0.24 * min(noseWrinkle, mouthUpper) - 0.2 * smile -
        0.1 * cheekRaise - 0.09 * eyeWide - 0.06 * jawOpen,
    )

    val evidence = mapOf(
      "happy" to happy, "sad" to sad, "angry" to angry,
      "surprised" to surprised, "disgusted" to disgusted, "fearful" to fearful,
    )
    val sorted = evidence.values.sortedDescending()
    val combined = clip(clip(sorted.getOrElse(0) { 0.0 }) + 0.5 * clip(sorted.getOrElse(1) { 0.0 }))
    val activity = listOf(
      browInner, browOuter, browDown, cheekRaise, noseWrinkle,
      smile, frown, mouthStretch, eyeWide, mouthPress,
    ).average()
    val modelNeutral = clip(max(src["_neutral"] ?: 0.0, src["neutral"] ?: 0.0))
    val neutral = clip(
      0.1 + 0.58 * (1 - combined).pow(1.9) * max(0.25, 1 - 0.6 * activity) + 0.2 * modelNeutral,
    )

    val all = evidence + ("neutral" to neutral)
    val sum = all.values.sumOf { max(0.0, it) }
    if (sum <= 0) return EXPRESSIONS.associateWith { if (it == "neutral") 1.0 else 0.0 }
    return all.mapValues { max(0.0, it.value) / sum }
  }

  /** A classe vencedora e sua confiança. */
  fun top(scores: Map<String, Double>): Pair<String, Double> {
    val ranked = scores.entries.sortedByDescending { it.value }
    val first = ranked.getOrNull(0) ?: return "neutral" to 0.0
    if (first.key == "neutral" && first.value < 0.62 && ranked.size >= 2) {
      val runnerUp = ranked[1]
      val thirdScore = ranked.getOrNull(2)?.value ?: 0.0
      if (runnerUp.value >= 0.30 && runnerUp.value - thirdScore >= 0.035) {
        return runnerUp.key to runnerUp.value
      }
    }
    return first.key to first.value
  }
}
