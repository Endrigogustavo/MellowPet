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
