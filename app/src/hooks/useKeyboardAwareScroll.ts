import { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from './useKeyboardHeight';

/** Folga entre o campo focado e o topo do teclado. */
const KEYBOARD_GAP = 24;

/**
 * Mantém o campo focado visível num `ScrollView` com o teclado aberto.
 *
 * - iOS: o próprio ScrollView ajusta os insets (`automaticallyAdjustKeyboardInsets`).
 * - Android edge-to-edge: a janela não redimensiona e o `KeyboardAvoidingView`
 *   não ajuda (veja `useKeyboardHeight`). A altura do teclado vira
 *   `bottomPadding` e o campo focado é rolado para cima do teclado quando ele
 *   abre ou quando se toca em outro campo.
 *
 * Uso: `const kb = useKeyboardAwareScroll();` e
 * `<ScrollView ref={kb.ref} {...kb.scrollProps} contentContainerStyle={{ paddingBottom: x + kb.bottomPadding }}>`.
 */
export function useKeyboardAwareScroll() {
  const keyboard = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const android = Platform.OS === 'android';
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);

  const revealFocused = useCallback(() => {
    if (!android || keyboard === 0) return;
    const input = TextInput.State.currentlyFocusedInput();
    if (!input) return;
    input.measureInWindow((_x, y, _w, h) => {
      const visibleBottom = Dimensions.get('window').height - keyboard - KEYBOARD_GAP;
      const visibleTop = insets.top + KEYBOARD_GAP;
      let delta = 0;
      if (y + h > visibleBottom) delta = y + h - visibleBottom;
      else if (y < visibleTop) delta = y - visibleTop;
      if (delta !== 0) {
        ref.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
      }
    });
  }, [android, keyboard, insets.top]);

  // Espera o `paddingBottom` novo entrar no layout; sem isso o `scrollTo` é
  // cortado no fim do conteúdo antigo.
  useEffect(() => {
    if (!android || keyboard === 0) return;
    const t = setTimeout(revealFocused, 60);
    return () => clearTimeout(t);
  }, [android, keyboard, revealFocused]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  // Trocar de campo com o teclado aberto não dispara evento de teclado no
  // Android; o toque no conteúdo é o sinal de que o foco pode ter mudado.
  const onTouchEnd = useCallback(() => {
    if (!android || keyboard === 0) return;
    setTimeout(revealFocused, 120);
  }, [android, keyboard, revealFocused]);

  return {
    ref,
    bottomPadding: android ? keyboard : 0,
    scrollProps: {
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled' as const,
      onScroll,
      scrollEventThrottle: 32,
      onTouchEnd,
    },
  };
}
