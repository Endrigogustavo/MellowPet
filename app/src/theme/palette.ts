/**
 * Cores do MellowPet.
 *
 * Os nomes vêm direto das CSS custom properties do design (`--pri`, `--t1`, …)
 * para que a tradução tela-a-tela continue óbvia.
 */

export type Palette = {
  page: string;
  bg: string;
  surf: string;
  bd: string;
  bdL: string;
  t1: string;
  t2: string;
  t3: string;
  pri: string;
  priL: string;
  tabBg: string;
  splashBg: string;
  sealBody: string;
  sealBelly: string;
  sealLine: string;
  sealWhisker: string;
  chipBg: string;
  chipBd: string;
};

export const LIGHT: Palette = {
  page: '#EDEAE6',
  bg: '#F8F9FB',
  surf: '#FFFFFF',
  bd: '#EBEBF0',
  bdL: '#F2F2F7',
  t1: '#1A1A2E',
  t2: '#6B7280',
  t3: '#9CA3AF',
  pri: '#6C63FF',
  priL: '#EEF0FF',
  tabBg: 'rgba(255,255,255,.92)',
  splashBg: '#4A3550',
  sealBody: '#FFFDFB',
  sealBelly: '#F7D9C6',
  sealLine: '#4A3550',
  sealWhisker: '#BCA7BA',
  chipBg: '#FFFFFF',
  chipBd: '#DFDBD5',
};

export const DARK: Palette = {
  page: '#1B1120',
  bg: '#241730',
  surf: '#33213D',
  bd: 'rgba(250,246,242,.11)',
  bdL: 'rgba(250,246,242,.09)',
  t1: '#FAF6F2',
  t2: '#C7B4D0',
  t3: '#9B8AA6',
  pri: '#C6A9F0',
  priL: 'rgba(198,169,240,.15)',
  tabBg: 'rgba(36,23,48,.92)',
  splashBg: '#4A3550',
  sealBody: '#F6EAE0',
  sealBelly: '#E7C9B6',
  sealLine: '#4A3550',
  sealWhisker: '#A98FA6',
  chipBg: '#33213D',
  chipBd: 'rgba(250,246,242,.13)',
};

/** Semáforo usado em bem-estar, alertas e intensidade. */
export const OK = '#10B981';
export const WARN = '#F59E0B';
export const DANGER = '#EF4444';

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
