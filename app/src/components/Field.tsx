import React from 'react';
import { type StyleProp, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { useTheme } from '../state/AppContext';
import { font } from '../theme/type';
import { Txt } from './ui';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  /** `outlined` tem borda sobre a superfície; `filled` usa o fundo da tela. */
  variant?: 'outlined' | 'filled';
  containerStyle?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  hint,
  variant = 'outlined',
  containerStyle,
  style,
  ...rest
}: Props) {
  const { T } = useTheme();
  const outlined = variant === 'outlined';

  return (
    <View style={containerStyle}>
      {label ? (
        <Txt s={11.5} w={800} c={T.t2} style={{ marginBottom: 7 }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={T.t3}
        {...rest}
        style={[
          {
            width: '100%',
            borderRadius: outlined ? 16 : 14,
            paddingHorizontal: 15,
            paddingVertical: outlined ? 14 : 13,
            fontSize: outlined ? 15 : 14,
            fontFamily: font(400),
            color: T.t1,
            backgroundColor: outlined ? T.surf : T.bg,
            ...(outlined ? { borderWidth: 1, borderColor: T.bd } : null),
          },
          style,
        ]}
      />
      {hint ? (
        <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 7 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
