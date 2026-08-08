/**
 * MellowPet Design System
 * Estética: branco gelo + soft pastels, inspirado em Apple + Material You
 */

export const Colors = {
  // Base
  background: '#F8F9FB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#EBEBF0',
  borderLight: '#F2F2F7',

  // Brand
  primary: '#6C63FF',
  primaryLight: '#EEF0FF',
  primaryDark: '#4C44CC',

  // Emotion palette
  happy: '#FFD166',
  happyLight: '#FFF8E7',
  sad: '#74B9FF',
  sadLight: '#EBF5FF',
  angry: '#FF7675',
  angryLight: '#FFF0F0',
  anxious: '#A29BFE',
  anxiousLight: '#F0EEFF',
  neutral: '#B2BEC3',
  neutralLight: '#F5F6F7',
  surprised: '#FD79A8',
  surprisedLight: '#FFF0F6',
  disgusted: '#55EFC4',
  disgustedLight: '#EDFFF9',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // System
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Overlays
  overlay: 'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.08)',

  // Gradients (use with LinearGradient)
  gradientPrimary: ['#6C63FF', '#A78BFA'],
  gradientHappy: ['#FFD166', '#FFBA08'],
  gradientSad: ['#74B9FF', '#5AA8F8'],
  gradientCalm: ['#A29BFE', '#6C63FF'],
  gradientWarm: ['#FD79A8', '#E84393'],
};

export const Typography = {
  // Font families
  display: 'System',       // Replace with custom font e.g. 'Nunito-ExtraBold'
  heading: 'System',       // e.g. 'Nunito-Bold'
  body: 'System',          // e.g. 'Nunito-Regular'
  mono: 'Courier New',

  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,
  display1: 48,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  section: 64,
};

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const EMOTION_COLORS: Record<string, { bg: string; light: string; icon: string; label: string }> = {
  happy:     { bg: Colors.happy,     light: Colors.happyLight,     icon: 'emoticon-happy-outline', label: 'Feliz' },
  sad:       { bg: Colors.sad,       light: Colors.sadLight,       icon: 'emoticon-sad-outline', label: 'Triste' },
  angry:     { bg: Colors.angry,     light: Colors.angryLight,     icon: 'emoticon-angry-outline', label: 'Com raiva' },
  anxious:   { bg: Colors.anxious,   light: Colors.anxiousLight,   icon: 'head-alert-outline', label: 'Ansioso' },
  neutral:   { bg: Colors.neutral,   light: Colors.neutralLight,   icon: 'emoticon-neutral-outline', label: 'Neutro' },
  surprised: { bg: Colors.surprised, light: Colors.surprisedLight, icon: 'emoticon-excited-outline', label: 'Surpreso' },
  disgusted: { bg: Colors.disgusted, light: Colors.disgustedLight, icon: 'emoticon-confused-outline', label: 'Incomodado' },
  fearful:   { bg: Colors.anxious,   light: Colors.anxiousLight,   icon: 'emoticon-frown-outline', label: 'Com medo' },
};
