import React, { useState } from 'react';
import { type StyleProp, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { ICONS } from '../data/content';
import { useTheme } from '../state/AppContext';
import { font } from '../theme/type';
import { DANGER, OK } from '../theme/palette';
import { Icon } from './Icon';
import { Touchable, Txt } from './ui';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  /** `outlined` tem borda sobre a superfície; `filled` usa o fundo da tela. */
  variant?: 'outlined' | 'filled';
  containerStyle?: StyleProp<ViewStyle>;
  /** Mensagem de erro — pinta a borda e substitui a dica. */
  error?: string | null;
  /** Confirmação visual quando o campo está válido. */
  success?: string | null;
  /** Mostra o olho de revelar senha. Implica `secureTextEntry`. */
  revealable?: boolean;
};

export function Field({
  label,
  hint,
  variant = 'outlined',
  containerStyle,
  style,
  error,
  success,
  revealable,
  ...rest
}: Props) {
  const { T } = useTheme();
  const outlined = variant === 'outlined';
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = error ? DANGER : focused ? T.pri : T.bd;

  return (
    <View style={containerStyle}>
      {label ? (
        <Txt s={11.5} w={800} c={error ? DANGER : T.t2} style={{ marginBottom: 7 }}>
          {label}
        </Txt>
      ) : null}

      <View style={{ justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={T.t3}
          {...rest}
          // Depois do spread: o olho controla a máscara, então quem passa
          // `revealable` não precisa gerenciar `secureTextEntry` por fora.
          secureTextEntry={revealable ? !revealed : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            {
              width: '100%',
              borderRadius: outlined ? 16 : 14,
              paddingHorizontal: 15,
              // Espaço à direita para o olho não cobrir o texto digitado.
              paddingRight: revealable ? 48 : 15,
              paddingVertical: outlined ? 14 : 13,
              fontSize: outlined ? 15 : 14,
              fontFamily: font(400),
              color: T.t1,
              backgroundColor: outlined ? T.surf : T.bg,
              ...(outlined || error || focused
                ? { borderWidth: error || focused ? 1.5 : 1, borderColor }
                : null),
            },
            style,
          ]}
        />

        {revealable ? (
          <Touchable
            onPress={() => setRevealed((v) => !v)}
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityRole="button"
            hitSlop={10}
            style={{
              position: 'absolute',
              right: 6,
              width: 38,
              height: 38,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={revealed ? ICONS.eyeOff : ICONS.eye} size={19} color={T.t3} />
          </Touchable>
        ) : null}
      </View>

      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7 }}>
          <Icon d={ICONS.alert} size={13} color={DANGER} circle sw={1.9} />
          <Txt s={11.5} lh={1.45} c={DANGER} style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : success ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <Icon d={ICONS.check} size={13} color={OK} sw={2.4} />
          <Txt s={11.5} c={OK}>
            {success}
          </Txt>
        </View>
      ) : hint ? (
        <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 7 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
