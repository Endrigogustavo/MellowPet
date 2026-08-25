package com.mellowpet.widget

/**
 * Tokens do design "MellowPet Widgets" traduzidos para recursos Android.
 *
 * O design tem seis emoções (neutral/happy/anxious/sad/surprised/angry); o
 * motor de visão do app produz oito chaves. Este é o único lugar que faz a
 * correspondência — `fearful` vira `anxious` e `disgusted` cai em `angry`,
 * que é a face tensa mais próxima; `unknown` fica neutro.
 */
internal object WidgetTheme {
  private fun key(emotion: String): String = when (emotion) {
    "happy" -> "happy"
    "sad" -> "sad"
    "angry", "disgusted" -> "angry"
    "surprised" -> "surprised"
    "fearful" -> "anxious"
    else -> "neutral"
  }

  /** O Mellow desenhado, com a expressão da emoção. */
  fun petDrawable(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.mellow_happy
    "sad" -> R.drawable.mellow_sad
    "angry" -> R.drawable.mellow_angry
    "surprised" -> R.drawable.mellow_surprised
    "anxious" -> R.drawable.mellow_anxious
    else -> R.drawable.mellow_neutral
  }

  /** Fundo claro tingido pela emoção (o `l` de cada emoção no design). */
  fun tintBackground(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_tint_happy
    "sad" -> R.drawable.widget_tint_sad
    "angry" -> R.drawable.widget_tint_angry
    "surprised" -> R.drawable.widget_tint_surprised
    "anxious" -> R.drawable.widget_tint_anxious
    else -> R.drawable.widget_tint_neutral
  }

  /** Cor cheia da emoção — usada em texto de destaque. */
  fun accent(emotion: String): Int = when (key(emotion)) {
    "happy" -> 0xFFFFD166.toInt()
    "sad" -> 0xFF74B9FF.toInt()
    "angry" -> 0xFFFF7675.toInt()
    "surprised" -> 0xFFFD79A8.toInt()
    "anxious" -> 0xFFA29BFE.toInt()
    else -> 0xFFB2BEC3.toInt()
  }

  /** Cartão colorido da playlist do momento (design PLAYLISTS). */
  fun playlistCard(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_pl_happy
    "sad" -> R.drawable.widget_pl_sad
    "angry" -> R.drawable.widget_pl_angry
    "surprised" -> R.drawable.widget_pl_surprised
    "anxious" -> R.drawable.widget_pl_anxious
    else -> R.drawable.widget_pl_neutral
  }

  /** Mesma cor do cartão acima, para o ícone dentro do botão branco. */
  fun playlistColor(emotion: String): Int = when (key(emotion)) {
    "happy" -> 0xFFE0A83C.toInt()
    "sad" -> 0xFF5B9BD8.toInt()
    "angry" -> 0xFFDE5F5E.toInt()
    "surprised" -> 0xFFD96A93.toInt()
    "anxious" -> 0xFF8B7FE8.toInt()
    else -> 0xFF55B49A.toInt()
  }
}
