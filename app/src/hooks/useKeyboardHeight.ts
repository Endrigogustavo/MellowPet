import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Altura atual do teclado, em dp — 0 quando fechado.
 *
 * O `KeyboardAvoidingView` não resolve no Android com edge-to-edge (padrão a
 * partir do RN 0.81): a janela não redimensiona e o campo fica embaixo do
 * teclado. Medir o evento e empurrar o conteúdo funciona nas duas plataformas
 * e não precisa de módulo nativo — ou seja, roda no Expo Go.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // No iOS o evento `will` acompanha a animação; o Android só emite `did`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
