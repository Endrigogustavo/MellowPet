/**
 * Cores do MellowPet.
 *
 * Os nomes vêm direto das CSS custom properties do design (`--pri`, `--t1`, …)
 * para que a tradução tela-a-tela continue óbvia, ancorados na geometria e
 * paleta canônica da marca (`brand/mellow_mark.py` e `app/DESIGN.md`).
 */

import type { EmotionKey } from '../data/emotions';

/** Primitivas da marca MellowPet (fonte da verdade em `brand/mellow_mark.py`). */
export const BRAND = {
  plum: '#4A3550',
  cream: '#FAF6F2',
  peach: '#FFC9A8',
  rose: '#F3AEB6',
  lilac: '#C6A9F0',
  muted: '#9B8AA6',
  stone: '#E6DFD7',
} as const;

export type Palette = {
  page: string;
  bg: string;
  surf: string;
  surfWarm: string;
  bd: string;
  bdL: string;
  t1: string;
  t2: string;
  t3: string;
  pri: string;
  priL: string;
  /** Texto e ícone sobre fundo `pri` (botão principal, chip cheio, bolha do usuário). */
  onPri: string;
  tabBg: string;
  splashBg: string;
  sealBody: string;
  sealBelly: string;
  sealLine: string;
  sealWhisker: string;
  chipBg: string;
  chipBd: string;
  ok: string;
  warn: string;
  danger: string;
  shadow: string;
  scrim: string;
  peach: string;
  rose: string;
};

export const LIGHT: Palette = {
  page: '#EFE9E2',
  bg: '#FAF6F2',
  surf: '#FFFFFF',
  surfWarm: '#F6EFE8',
  bd: '#E6DFD7',
  bdL: '#EFE9E1',
  t1: '#2B1E30',
  t2: '#5C4963',
  t3: '#745F7C',
  pri: '#684878',
  priL: '#F3ECF7',
  onPri: '#FFFFFF',
  tabBg: 'rgba(250,246,242,.92)',
  splashBg: '#4A3550',
  sealBody: '#ECE2D8',
  sealBelly: '#F7D9C6',
  sealLine: '#4A3550',
  sealWhisker: '#B59EB3',
  chipBg: '#FFFFFF',
  chipBd: '#DFD6CC',
  ok: '#287D5E',
  warn: '#9E5A10',
  danger: '#C23E3E',
  shadow: '#2B1E30',
  scrim: 'rgba(43,30,48,.42)',
  peach: '#FFC9A8',
  rose: '#F3AEB6',
};

export const DARK: Palette = {
  page: '#140E18',
  bg: '#1C1422',
  surf: '#281D30',
  surfWarm: '#23192B',
  bd: 'rgba(250,246,242,.11)',
  bdL: 'rgba(250,246,242,.07)',
  t1: '#FAF6F2',
  t2: '#D4C5DC',
  t3: '#AE9CB8',
  pri: '#CCAFF2',
  priL: 'rgba(204,175,242,.15)',
  onPri: '#221529',
  tabBg: 'rgba(28,20,34,.92)',
  splashBg: '#4A3550',
  sealBody: '#F6EAE0',
  sealBelly: '#E7C9B6',
  sealLine: '#4A3550',
  sealWhisker: '#A98FA6',
  chipBg: '#281D30',
  chipBd: 'rgba(250,246,242,.13)',
  ok: '#5EDBA8',
  warn: '#F5BC6B',
  danger: '#F28B8B',
  shadow: '#09050C',
  scrim: 'rgba(12,8,16,.64)',
  peach: '#FFC9A8',
  rose: '#F3AEB6',
};

/** Semáforo acessível (>= 4.6:1 sobre #FAF6F2 e #FFFFFF) usado em bem-estar, alertas e intensidade. */
export const OK = '#287D5E';
export const WARN = '#9E5A10';
export const DANGER = '#C23E3E';

/**
 * Tinta acessível para rótulos e ícones de emoção quando renderizados como texto.
 * Os tons pastéis (`EMOTIONS[k].c`) servem para halos e barras; para leitura textual
 * sobre superfície clara ou escura, estes pares garantem contraste WCAG AA (>= 4.5:1).
 */
export const EMO_INK_LIGHT: Record<EmotionKey, string> = {
  happy: '#8A5A00',
  sad: '#235A94',
  angry: '#A63232',
  neutral: '#4E5B61',
  surprised: '#9E2B59',
  disgusted: '#1B6E56',
  fearful: '#4B429E',
  unknown: '#5C4963',
};

export const EMO_INK_DARK: Record<EmotionKey, string> = {
  happy: '#FFE08A',
  sad: '#9BCEFF',
  angry: '#FF9E9D',
  neutral: '#CBD5DA',
  surprised: '#FF9EC0',
  disgusted: '#7BF5D4',
  fearful: '#C2BDFF',
  unknown: '#AE9CB8',
};

export function emotionInk(emotion: EmotionKey, isDark: boolean): string {
  return isDark ? EMO_INK_DARK[emotion] : EMO_INK_LIGHT[emotion];
}

/** Interpola dois hex `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return '#' + ch(r1, r2) + ch(g1, g2) + ch(b1, b2);
}

/** `#rrggbb` + alpha → `rgba(...)`. */
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
