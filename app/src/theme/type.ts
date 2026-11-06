/**
 * Nunito em cinco pesos. No React Native o `fontWeight` não seleciona o arquivo
 * certo de uma família customizada, então cada peso vira uma família própria.
 */
export const FONT = {
  400: 'Nunito_400Regular',
  600: 'Nunito_600SemiBold',
  700: 'Nunito_700Bold',
  800: 'Nunito_800ExtraBold',
  900: 'Nunito_900Black',
} as const;

export type FontWeight = keyof typeof FONT;

export function font(weight: FontWeight = 400): string {
  return FONT[weight];
}

/**
 * Escala tipográfica semântica documentada em `app/DESIGN.md`.
 * Títulos dispensam eyebrow em caixa alta; campos de entrada usam >= 16px
 * para evitar auto-zoom em navegadores mobile e WebViews iOS.
 */
export const TYPE = {
  display: { s: 44, w: 800 as FontWeight, lh: 1.05, ls: -1.4 },
  headlineLg: { s: 30, w: 800 as FontWeight, lh: 1.15, ls: -0.7 },
  headlineMd: { s: 22, w: 800 as FontWeight, lh: 1.2, ls: -0.3 },
  title: { s: 16, w: 800 as FontWeight, lh: 1.3, ls: 0 },
  bodyLg: { s: 16, w: 400 as FontWeight, lh: 1.55, ls: 0 },
  bodyMd: { s: 14.5, w: 400 as FontWeight, lh: 1.55, ls: 0 },
  bodySm: { s: 13, w: 600 as FontWeight, lh: 1.45, ls: 0 },
  label: { s: 13, w: 700 as FontWeight, lh: 1.2, ls: 0 },
  caption: { s: 12, w: 600 as FontWeight, lh: 1.4, ls: 0 },
} as const;

export type TypeRole = keyof typeof TYPE;
