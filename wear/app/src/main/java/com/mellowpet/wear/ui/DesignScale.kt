package com.mellowpet.wear.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Converte as medidas do arquivo de design para a tela real.
 *
 * O design desenha o relogio num espaco de 300 unidades que representa a tela
 * inteira. Escrever dp fixo a partir dali foi o erro da primeira versao: a
 * hora ficou gigante e o bichinho vazou pela borda. Aqui cada medida volta a
 * ser o que o design diz — uma fracao da tela — o que tambem faz o layout
 * servir o Watch4 de 40 mm e o de 44 mm sem variante.
 */
private const val DESIGN_SPACE = 300f

/** Largura util da tela, em dp. */
@Composable
@ReadOnlyComposable
private fun screenDp(): Float = LocalConfiguration.current.screenWidthDp.toFloat()

/** Medida do design (espaco 300) em dp desta tela. */
@Composable
@ReadOnlyComposable
fun d(designUnits: Float): Dp = (screenDp() * designUnits / DESIGN_SPACE).dp

/** Tipografia do design (espaco 300) em sp desta tela. */
@Composable
@ReadOnlyComposable
fun s(designUnits: Float): TextUnit = (screenDp() * designUnits / DESIGN_SPACE).sp
