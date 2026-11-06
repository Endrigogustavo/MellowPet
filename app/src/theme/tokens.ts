import { Easing } from 'react-native';

/**
 * Escala de espaçamento e ritmo Gestalt 2x (`app/DESIGN.md`).
 * A distância entre grupos distintos (`xl` / `xxl`) deve ter pelo menos o dobro
 * do espaçamento interno de um grupo (`xs` / `sm`).
 */
export const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  section: 40,
} as const;

/**
 * Raios de borda por papel estrutural — nunca um único raio genérico em tudo.
 */
export const RADIUS = {
  xs: 8,
  control: 14,
  card: 22,
  stage: 28,
  full: 9999,
} as const;

/**
 * Ergonomia tátil mobile: todo alvo interativo respeita mínimo físico de 44x44px.
 */
export const TOUCH = {
  minSize: 44,
  comfortableSize: 48,
  hitSlop8: { top: 8, bottom: 8, left: 8, right: 8 },
  hitSlop10: { top: 10, bottom: 10, left: 10, right: 10 },
  hitSlop12: { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

/**
 * Sistema de movimento reativo (< 300ms para UI, springs calmas para presença).
 * Derivado da filosofia de design engineering de Emil Kowalski:
 * - Nunca `ease-in` em UI; sempre `ease-out` forte na entrada/resposta.
 * - Nunca animar a partir de `scale(0)`; usar `0.96` com opacidade.
 */
export const MOTION = {
  duration: {
    press: 120,
    fast: 160,
    base: 200,
    calm: 240,
  },
  scale: {
    pressed: 0.97,
    enterFrom: 0.96,
  },
  easing: {
    out: Easing.bezier(0.23, 1, 0.32, 1),
    inOut: Easing.bezier(0.77, 0, 0.175, 1),
    drawer: Easing.bezier(0.32, 0.72, 0, 1),
  },
  spring: {
    /** Mola serena para interações com o Mellow e seletores táteis. */
    calm: { damping: 18, stiffness: 180, mass: 1 },
    /** Mola responsiva sem overshoot exagerado para controles. */
    snappy: { damping: 22, stiffness: 260, mass: 0.9 },
  },
} as const;

/**
 * Classificação de Modos de Interface por superfície (`impeccable` + `DESIGN.md`).
 */
export type InterfaceMode = 'experience' | 'operate' | 'read-operate';

export const SURFACE_MODES = {
  experience: ['splash', 'home', 'lullaby'] as const,
  operate: ['onboarding', 'login', 'caresignup', 'checkin', 'routine', 'tools', 'music', 'chat', 'settings', 'wardrobe', 'sos', 'crisisplan'] as const,
  readOperate: ['dashboard', 'heatmap', 'care', 'carealerts', 'careaudit', 'careplan', 'careguide', 'agenda', 'fairness'] as const,
} as const;

