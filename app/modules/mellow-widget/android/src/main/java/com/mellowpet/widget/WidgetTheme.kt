package com.mellowpet.widget

/**
 * Tokens do design "MellowPet Widgets" traduzidos para recursos Android.
 *
 * O design tem seis emoções (neutral/happy/anxious/sad/surprised/angry); o
 * motor de visão do app produz oito chaves. Este é o único lugar que faz a
 * correspondência — `fearful` vira `anxious` e `disgusted` cai em `angry`,
 * que é a face tensa mais próxima; `unknown` fica neutro.
 *
 * Os textos (frase do dia, plano, próximo passo) vêm literalmente das
 * tabelas QUOTES/PLANS/NEXT do design e vivem aqui, no widget, porque não
 * dependem de nada do servidor.
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

  fun petDrawable(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.mellow_happy
    "sad" -> R.drawable.mellow_sad
    "angry" -> R.drawable.mellow_angry
    "surprised" -> R.drawable.mellow_surprised
    "anxious" -> R.drawable.mellow_anxious
    else -> R.drawable.mellow_neutral
  }

  fun tintBackground(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_tint_happy
    "sad" -> R.drawable.widget_tint_sad
    "angry" -> R.drawable.widget_tint_angry
    "surprised" -> R.drawable.widget_tint_surprised
    "anxious" -> R.drawable.widget_tint_anxious
    else -> R.drawable.widget_tint_neutral
  }

  /** Mesmo fundo tingido, no raio 26 dos widgets de faixa (4×1 e 2×1). */
  fun tint26(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_tint26_happy
    "sad" -> R.drawable.widget_tint26_sad
    "angry" -> R.drawable.widget_tint26_angry
    "surprised" -> R.drawable.widget_tint26_surprised
    "anxious" -> R.drawable.widget_tint26_anxious
    else -> R.drawable.widget_tint26_neutral
  }

  fun accent(emotion: String): Int = when (key(emotion)) {
    "happy" -> 0xFFFFD166.toInt()
    "sad" -> 0xFF74B9FF.toInt()
    "angry" -> 0xFFFF7675.toInt()
    "surprised" -> 0xFFFD79A8.toInt()
    "anxious" -> 0xFFA29BFE.toInt()
    else -> 0xFFB2BEC3.toInt()
  }

  /* ── Efeitos do design ────────────────────────────────────────────────
   * RemoteViews não roda CSS: cada keyframe do .dc.html virou uma
   * AnimationDrawable, e cada radial-gradient um <gradient type="radial">.
   * Ver gen_fx.py, que gerou esses recursos a partir dos keyframes.        */

  /** Fundo tingido + neon radial (heroGlow/heroGlow2 do design). */
  fun glowBackground(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_glow_happy
    "sad" -> R.drawable.widget_glow_sad
    "angry" -> R.drawable.widget_glow_angry
    "surprised" -> R.drawable.widget_glow_surprised
    "anxious" -> R.drawable.widget_glow_anxious
    else -> R.drawable.widget_glow_neutral
  }

  /** Cartão de música com o brilho branco do design. */
  fun playlistGlow(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_plglow_happy
    "sad" -> R.drawable.widget_plglow_sad
    "angry" -> R.drawable.widget_plglow_angry
    "surprised" -> R.drawable.widget_plglow_surprised
    "anxious" -> R.drawable.widget_plglow_anxious
    else -> R.drawable.widget_plglow_neutral
  }

  /**
   * Quadros de wg-float e wg-halo.
   *
   * AnimationDrawable não recebe `start()` dentro de RemoteViews e fica
   * parada no primeiro frame — por isso a animação é um ViewFlipper, e o
   * provider precisa dos frames avulsos para apontar cada filho dele.
   */
  fun floatFrames(emotion: String): IntArray = when (key(emotion)) {
    "happy" -> intArrayOf(
      R.drawable.widget_float_happy_0, R.drawable.widget_float_happy_1,
      R.drawable.widget_float_happy_2, R.drawable.widget_float_happy_3,
      R.drawable.widget_float_happy_4, R.drawable.widget_float_happy_5,
      R.drawable.widget_float_happy_6, R.drawable.widget_float_happy_7,
      R.drawable.widget_float_happy_8, R.drawable.widget_float_happy_9,
    )
    "sad" -> intArrayOf(
      R.drawable.widget_float_sad_0, R.drawable.widget_float_sad_1,
      R.drawable.widget_float_sad_2, R.drawable.widget_float_sad_3,
      R.drawable.widget_float_sad_4, R.drawable.widget_float_sad_5,
      R.drawable.widget_float_sad_6, R.drawable.widget_float_sad_7,
      R.drawable.widget_float_sad_8, R.drawable.widget_float_sad_9,
    )
    "angry" -> intArrayOf(
      R.drawable.widget_float_angry_0, R.drawable.widget_float_angry_1,
      R.drawable.widget_float_angry_2, R.drawable.widget_float_angry_3,
      R.drawable.widget_float_angry_4, R.drawable.widget_float_angry_5,
      R.drawable.widget_float_angry_6, R.drawable.widget_float_angry_7,
      R.drawable.widget_float_angry_8, R.drawable.widget_float_angry_9,
    )
    "surprised" -> intArrayOf(
      R.drawable.widget_float_surprised_0, R.drawable.widget_float_surprised_1,
      R.drawable.widget_float_surprised_2, R.drawable.widget_float_surprised_3,
      R.drawable.widget_float_surprised_4, R.drawable.widget_float_surprised_5,
      R.drawable.widget_float_surprised_6, R.drawable.widget_float_surprised_7,
      R.drawable.widget_float_surprised_8, R.drawable.widget_float_surprised_9,
    )
    "anxious" -> intArrayOf(
      R.drawable.widget_float_anxious_0, R.drawable.widget_float_anxious_1,
      R.drawable.widget_float_anxious_2, R.drawable.widget_float_anxious_3,
      R.drawable.widget_float_anxious_4, R.drawable.widget_float_anxious_5,
      R.drawable.widget_float_anxious_6, R.drawable.widget_float_anxious_7,
      R.drawable.widget_float_anxious_8, R.drawable.widget_float_anxious_9,
    )
    else -> intArrayOf(
      R.drawable.widget_float_neutral_0, R.drawable.widget_float_neutral_1,
      R.drawable.widget_float_neutral_2, R.drawable.widget_float_neutral_3,
      R.drawable.widget_float_neutral_4, R.drawable.widget_float_neutral_5,
      R.drawable.widget_float_neutral_6, R.drawable.widget_float_neutral_7,
      R.drawable.widget_float_neutral_8, R.drawable.widget_float_neutral_9,
    )
  }

  fun haloFrames(emotion: String): IntArray = when (key(emotion)) {
    "happy" -> intArrayOf(
      R.drawable.widget_halo_happy_0, R.drawable.widget_halo_happy_1,
      R.drawable.widget_halo_happy_2, R.drawable.widget_halo_happy_3,
      R.drawable.widget_halo_happy_4, R.drawable.widget_halo_happy_5,
      R.drawable.widget_halo_happy_6, R.drawable.widget_halo_happy_7,
      R.drawable.widget_halo_happy_8, R.drawable.widget_halo_happy_9,
    )
    "sad" -> intArrayOf(
      R.drawable.widget_halo_sad_0, R.drawable.widget_halo_sad_1,
      R.drawable.widget_halo_sad_2, R.drawable.widget_halo_sad_3,
      R.drawable.widget_halo_sad_4, R.drawable.widget_halo_sad_5,
      R.drawable.widget_halo_sad_6, R.drawable.widget_halo_sad_7,
      R.drawable.widget_halo_sad_8, R.drawable.widget_halo_sad_9,
    )
    "angry" -> intArrayOf(
      R.drawable.widget_halo_angry_0, R.drawable.widget_halo_angry_1,
      R.drawable.widget_halo_angry_2, R.drawable.widget_halo_angry_3,
      R.drawable.widget_halo_angry_4, R.drawable.widget_halo_angry_5,
      R.drawable.widget_halo_angry_6, R.drawable.widget_halo_angry_7,
      R.drawable.widget_halo_angry_8, R.drawable.widget_halo_angry_9,
    )
    "surprised" -> intArrayOf(
      R.drawable.widget_halo_surprised_0, R.drawable.widget_halo_surprised_1,
      R.drawable.widget_halo_surprised_2, R.drawable.widget_halo_surprised_3,
      R.drawable.widget_halo_surprised_4, R.drawable.widget_halo_surprised_5,
      R.drawable.widget_halo_surprised_6, R.drawable.widget_halo_surprised_7,
      R.drawable.widget_halo_surprised_8, R.drawable.widget_halo_surprised_9,
    )
    "anxious" -> intArrayOf(
      R.drawable.widget_halo_anxious_0, R.drawable.widget_halo_anxious_1,
      R.drawable.widget_halo_anxious_2, R.drawable.widget_halo_anxious_3,
      R.drawable.widget_halo_anxious_4, R.drawable.widget_halo_anxious_5,
      R.drawable.widget_halo_anxious_6, R.drawable.widget_halo_anxious_7,
      R.drawable.widget_halo_anxious_8, R.drawable.widget_halo_anxious_9,
    )
    else -> intArrayOf(
      R.drawable.widget_halo_neutral_0, R.drawable.widget_halo_neutral_1,
      R.drawable.widget_halo_neutral_2, R.drawable.widget_halo_neutral_3,
      R.drawable.widget_halo_neutral_4, R.drawable.widget_halo_neutral_5,
      R.drawable.widget_halo_neutral_6, R.drawable.widget_halo_neutral_7,
      R.drawable.widget_halo_neutral_8, R.drawable.widget_halo_neutral_9,
    )
  }

  /** Barra colorida da linha do dia. */
  fun barFor(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_bar_happy
    "sad" -> R.drawable.widget_bar_sad
    "angry" -> R.drawable.widget_bar_angry
    "surprised" -> R.drawable.widget_bar_surprised
    "anxious" -> R.drawable.widget_bar_anxious
    else -> R.drawable.widget_bar_neutral
  }

  fun playlistCard(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_pl_happy
    "sad" -> R.drawable.widget_pl_sad
    "angry" -> R.drawable.widget_pl_angry
    "surprised" -> R.drawable.widget_pl_surprised
    "anxious" -> R.drawable.widget_pl_anxious
    else -> R.drawable.widget_pl_neutral
  }

  fun playlistBlock(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_plblock_happy
    "sad" -> R.drawable.widget_plblock_sad
    "angry" -> R.drawable.widget_plblock_angry
    "surprised" -> R.drawable.widget_plblock_surprised
    "anxious" -> R.drawable.widget_plblock_anxious
    else -> R.drawable.widget_plblock_neutral
  }

  fun playlistRound(emotion: String): Int = when (key(emotion)) {
    "happy" -> R.drawable.widget_plround_happy
    "sad" -> R.drawable.widget_plround_sad
    "angry" -> R.drawable.widget_plround_angry
    "surprised" -> R.drawable.widget_plround_surprised
    "anxious" -> R.drawable.widget_plround_anxious
    else -> R.drawable.widget_plround_neutral
  }

  fun playlistColor(emotion: String): Int = when (key(emotion)) {
    "happy" -> 0xFFE0A83C.toInt()
    "sad" -> 0xFF5B9BD8.toInt()
    "angry" -> 0xFFDE5F5E.toInt()
    "surprised" -> 0xFFD96A93.toInt()
    "anxious" -> 0xFF8B7FE8.toInt()
    else -> 0xFF55B49A.toInt()
  }

  /** Rótulo em português — o widget precisa dele quando registra um
   * sentimento sozinho, sem o app para traduzir a chave. */
  fun label(emotion: String): String = when (key(emotion)) {
    "happy" -> "Feliz"
    "sad" -> "Triste"
    "angry" -> "Com raiva"
    "surprised" -> "Surpreso"
    "anxious" -> "Ansioso"
    else -> "Neutro"
  }

  /** Mesmos valores de MOOD_PCT em src/widgets/widgetBridge.ts. */
  fun moodPct(emotion: String): Int = when (key(emotion)) {
    "happy" -> 93
    "surprised" -> 66
    "anxious" -> 48
    "sad" -> 39
    "angry" -> 31
    else -> 71
  }

  fun variant(emotion: String): String = when (key(emotion)) {
    "happy" -> "radiante"
    "sad" -> "melancólico"
    "angry" -> "tenso"
    "surprised" -> "alerta"
    "anxious" -> "acelerado"
    else -> "estável"
  }

  fun quote(emotion: String): String = when (key(emotion)) {
    "happy" -> "Guarde o que fez hoje dar certo. Serve para os dias difíceis."
    "sad" -> "Não precisa resolver o dia inteiro. Só o próximo passo."
    "angry" -> "Trinta segundos antes de decidir qualquer coisa."
    "surprised" -> "Respire uma vez antes de responder. A pressa não é sua amiga."
    "anxious" -> "A respiração curta passa. Alongue a saída do ar e conte até seis."
    else -> "Um dia estável também é um bom dia. Escolha uma coisa só e comece."
  }

  fun plan(emotion: String): List<String> = when (key(emotion)) {
    "happy" -> listOf("Escreva o que deu certo", "Mande a boa notícia", "Escolha a próxima tarefa")
    "sad" -> listOf("Beba um copo de água", "Escreva o que pesou", "Combine algo para amanhã")
    "angry" -> listOf("Respire 4-4-6, seis vezes", "Água fria no rosto", "Escolha uma ação só")
    "surprised" -> listOf("Uma respiração completa", "Nomeie o que aconteceu", "Decida se responde agora")
    "anxious" -> listOf("Inspire 4s, solte 6s", "Nomeie a preocupação", "Faça só a primeira etapa")
    else -> listOf("Escolha uma tarefa só", "Timer de 25 minutos", "Pausa real de 5 minutos")
  }

  data class Step(val title: String, val sub: String, val icon: Int)

  fun nextStep(emotion: String): Step = when (key(emotion)) {
    "happy" -> Step("Registre o que deu certo", "Serve para os dias difíceis", R.drawable.wi_journal)
    "sad" -> Step("Mande uma mensagem curta", "Para alguém de confiança", R.drawable.wi_chat)
    "angry" -> Step("Água fria no rosto", "Vinte segundos bastam", R.drawable.wi_water)
    "surprised" -> Step("Uma respiração completa", "Antes de responder", R.drawable.wi_info)
    "anxious" -> Step("Alongue a expiração", "Inspire 4s, solte 6s", R.drawable.wi_breathe)
    else -> Step("Escolha uma tarefa só", "Timer de 25 min e começa", R.drawable.wi_timer)
  }
}
