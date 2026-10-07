package com.mellowpet.wear.data

import androidx.compose.ui.graphics.Color

/**
 * Porte do subconjunto de app/src/data/emotions.ts que o relogio precisa.
 *
 * Os `path` sao as MESMAS strings SVG do app do celular, de proposito: o
 * Compose sabe interpretar path de SVG (PathParser), entao o bichinho e o
 * mesmo desenho, nao um redesenho que vai divergir na primeira mudanca.
 * Qualquer ajuste de forma no app precisa ser copiado para ca — e o preco de
 * ter duas plataformas sem um pipeline de assets compartilhado.
 */
enum class Emotion(
  val key: String,
  val label: String,
  val color: Color,
) {
  HAPPY("happy", "Feliz", Color(0xFFFFD166)),
  NEUTRAL("neutral", "Neutro", Color(0xFFB2BEC3)),
  SAD("sad", "Triste", Color(0xFF74B9FF)),
  ANGRY("angry", "Com raiva", Color(0xFFFF7675)),
  FEARFUL("fearful", "Receio", Color(0xFFA29BFE)),
  SURPRISED("surprised", "Surpreso", Color(0xFFFD79A8)),
  DISGUSTED("disgusted", "Incomodado", Color(0xFF55EFC4));

  companion object {
    fun fromKey(key: String?): Emotion = entries.firstOrNull { it.key == key } ?: NEUTRAL
  }
}

/** Olhos (esquerdo, direito) por emocao — arcos, menos em `surprised`. */
val EYES: Map<Emotion, Pair<String, String>> = mapOf(
  Emotion.HAPPY to ("M 30 51 q 7 -9 14 0" to "M 56 51 q 7 -9 14 0"),
  Emotion.NEUTRAL to ("M 30 51 q 7 -7 14 0" to "M 56 51 q 7 -7 14 0"),
  Emotion.SAD to ("M 30 49 q 7 8 14 0" to "M 56 49 q 7 8 14 0"),
  Emotion.ANGRY to ("M 30 46 L 44 52" to "M 70 46 L 56 52"),
  Emotion.FEARFUL to ("M 30 50 q 7 -4 14 0" to "M 56 50 q 7 -4 14 0"),
  Emotion.SURPRISED to (
    "M 30 51 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0" to
      "M 56 51 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0"
    ),
  Emotion.DISGUSTED to ("M 30 52 q 7 -5 14 0" to "M 56 50 q 7 -3 14 0"),
)

/** Sobrancelhas. Par vazio = sem sobrancelha para essa emocao. */
val BROWS: Map<Emotion, Pair<String, String>> = mapOf(
  Emotion.HAPPY to ("" to ""),
  Emotion.NEUTRAL to ("" to ""),
  Emotion.SAD to ("M 29 46 q 7 -5 13 -7" to "M 71 46 q -7 -5 -13 -7"),
  Emotion.ANGRY to ("M 28 39 L 43 47" to "M 72 39 L 57 47"),
  Emotion.FEARFUL to ("M 29 44 q 7 -4 13 -3" to "M 71 44 q -7 -4 -13 -3"),
  Emotion.SURPRISED to ("M 28 38 q 7 -4 14 0" to "M 72 38 q -7 -4 -14 0"),
  Emotion.DISGUSTED to ("M 28 40 q 7 2 14 3" to "M 71 45 q -6 -4 -12 -5"),
)

val MOUTH: Map<Emotion, String> = mapOf(
  Emotion.HAPPY to "M 40 70 q 10 10 20 0",
  Emotion.NEUTRAL to "M 41 70.5 q 9 4 18 0",
  Emotion.SAD to "M 41 77 q 9 -7 18 0",
  Emotion.ANGRY to "M 41 77 q 9 -6 18 0",
  Emotion.FEARFUL to "M 41 73 q 4.5 -5 9 0 q 4.5 5 9 0",
  Emotion.SURPRISED to "M 50 73 a 4.6 5.6 0 1 0 0.1 0",
  Emotion.DISGUSTED to "M 41 75 q 9 -4 18 0",
)

/** Cabeca do bichinho, viewBox 100x100 (data/pets.ts). */
const val HEAD = "M 50 8 a 42 42 0 1 0 0.1 0 Z"

/** Bigodes do focinho (components/PetFace.tsx). */
val WHISKERS = listOf(
  "M 30 64 L 8 59",
  "M 29 68.5 L 6 68",
  "M 30 73 L 9 78",
  "M 70 64 L 92 59",
  "M 71 68.5 L 94 68",
  "M 70 73 L 91 78",
)

/** Focinho da foca (DET.seal.m). */
const val MUZZLE = "M 27 66 a 23 17 0 1 0 46 0 a 23 17 0 1 0 -46 0"

/** Foca, o bichinho inicial (PET_TYPES). Os outros tipos entram quando o
 * relogio souber qual o dono escolheu — hoje o celular nao envia isso. */
val PET_BODY = Color(0xFFA8B0B4)
val LINE = Color(0xFF2E2A33)
val BLUSH = Color(0xFFF0A0AC)
