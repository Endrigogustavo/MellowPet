import React, { useState } from 'react';
import { type StyleProp, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { ICONS } from '../data/content';
import { useTheme } from '../state/AppContext';
import { font } from '../theme/type';
import { Icon } from './Icon';
import { Touchable, Txt } from './ui';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  /** `outlined` tem borda sobre a superfície; `filled` usa superfície quente suave. */
  variant?: 'outlined' | 'filled';
  containerStyle?: StyleProp<ViewStyle>;
  /** Mensagem de erro: pinta a borda e substitui a dica. */
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

  const borderColor = error ? T.danger : focused ? T.pri : T.bd;

  return (
    <View style={containerStyle}>
      {label ? (
        <Txt s={12.5} w={700} c={error ? T.danger : T.t2} style={{ marginBottom: 7 }}>
          {label}
        </Txt>
      ) : null}

      <View style={{ justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={T.t3}
          // O rótulo visual não fica ligado ao input no leitor de tela; sem
          // isto ele lê só o placeholder (ou nada, com o campo preenchido).
          accessibilityLabel={label ?? rest.placeholder}
          accessibilityHint={error || hint || undefined}
          {...rest}
          // Depois do spread: o olho controla a máscara sem gerenciamento externo.
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
              minHeight: 50,
              borderRadius: outlined ? 15 : 14,
              paddingHorizontal: 15,
              // Espaço para o botão tátil de 44×44px não cobrir o texto digitado.
              paddingRight: revealable ? 50 : 15,
              paddingVertical: 13,
              // >= 16px evita zoom involuntário no Safari iOS ao focar o campo.
              fontSize: 16,
              fontFamily: font(400),
              color: T.t1,
              backgroundColor: outlined ? T.surf : T.surfWarm,
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
            hitSlop={6}
            style={{
              position: 'absolute',
              right: 3,
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={revealed ? ICONS.eyeOff : ICONS.eye} size={19} color={T.t2} />
          </Touchable>
        ) : null}
      </View>

      {error ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7 }}
        >
          <Icon d={ICONS.alert} size={13} color={T.danger} circle sw={1.9} />
          <Txt s={12} lh={1.45} c={T.danger} style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : success ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <Icon d={ICONS.check} size={13} color={T.ok} sw={2.4} />
          <Txt s={12} c={T.ok}>
            {success}
          </Txt>
        </View>
      ) : hint ? (
        <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 7 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
