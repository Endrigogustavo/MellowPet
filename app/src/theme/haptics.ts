import { Platform, Vibration } from 'react-native';

/**
 * Feedback tátil sutil para interações humanas (carinho no Mellow, escolha de
 * emoção, conclusão de rotina). Curto e silencioso para acalmar sem assustar.
 */
export function hapticTap(enabled = true) {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8);
      }
    } catch {
      // Ignorado em navegadores sem suporte a vibração.
    }
    return;
  }
  try {
    Vibration.vibrate(10);
  } catch {
    // Ignorado quando sem permissão nativa.
  }
}

export function hapticSuccess(enabled = true) {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([8, 24, 12]);
      }
    } catch {
      // Ignorado em navegadores sem suporte a vibração.
    }
    return;
  }
  try {
    Vibration.vibrate([0, 10, 30, 14]);
  } catch {
    // Ignorado quando sem permissão nativa.
  }
}

