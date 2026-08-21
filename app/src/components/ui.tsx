import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  Text,
  type TextProps,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { font, type FontWeight } from '../theme/type';
import { useTheme } from '../state/AppContext';

/* ── Texto ──────────────────────────────────────────────────────────────── */

type TxtProps = TextProps & {
  /** fontSize */
  s?: number;
  /** peso da Nunito */
  w?: FontWeight;
  /** cor */
  c?: string;
  /** lineHeight como múltiplo do tamanho */
  lh?: number;
  /** letterSpacing */
  ls?: number;
  center?: boolean;
  caps?: boolean;
  cap?: boolean;
};

export function Txt({ s = 14, w = 400, c, lh, ls, center, caps, cap, style, ...rest }: TxtProps) {
  const { T } = useTheme();
  const base: TextStyle = {
    fontFamily: font(w),
    fontSize: s,
    color: c ?? T.t1,
  };
  if (lh) base.lineHeight = Math.round(s * lh);
  if (ls !== undefined) base.letterSpacing = ls;
  if (center) base.textAlign = 'center';
  if (caps) base.textTransform = 'uppercase';
  if (cap) base.textTransform = 'capitalize';
  return <Text {...rest} style={[base, style]} />;
}

/** Rótulo pequeno em caixa alta que abre quase todas as seções do design. */
export function Eyebrow({ children, ls = 1.8 }: { children: React.ReactNode; ls?: number }) {
  const { T } = useTheme();
  return (
    <Txt s={11} w={800} c={T.t3} ls={ls}>
      {children}
    </Txt>
  );
}

/** Cabeçalho de tela: rótulo + título grande. */
export function ScreenTitle({ label, title }: { label: string; title: string }) {
  const { T } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
      <Eyebrow>{label}</Eyebrow>
      <Txt s={32} w={800} c={T.t1} ls={-1} lh={1.1} style={{ marginTop: 6 }}>
        {title}
      </Txt>
    </View>
  );
}

/* ── Superfícies ────────────────────────────────────────────────────────── */

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Sem borda e com fundo customizado (usado nos cartões de destaque). */
  bg?: string;
  radius?: number;
  padding?: number;
  bordered?: boolean;
};

export function Card({ children, style, bg, radius = 22, padding = 16, bordered = true }: CardProps) {
  const { T } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: bg ?? T.surf,
          borderRadius: radius,
          padding,
          ...(bordered && !bg ? { borderWidth: 1, borderColor: T.bd } : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Botão genérico com feedback de toque. */
export function Touchable({ style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style as ViewStyle]}
    />
  );
}

/* ── Controles ──────────────────────────────────────────────────────────── */

/** Interruptor 50×29 do design. */
export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { T } = useTheme();
  const [v] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    Animated.timing(v, {
      toValue: on ? 1 : 0,
      duration: 250,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [on, v]);

  return (
    <Touchable onPress={onPress} hitSlop={8}>
      <View
        style={{
          width: 50,
          height: 29,
          borderRadius: 999,
          padding: 3,
          backgroundColor: on ? T.pri : T.bd,
        }}
      >
        <Animated.View
          style={{
            width: 23,
            height: 23,
            borderRadius: 999,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
            transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 21] }) }],
          }}
        />
      </View>
    </Touchable>
  );
}

/** Linha com rótulo, descrição e interruptor. */
export function ToggleRow({
  label,
  sub,
  on,
  onPress,
  divider,
}: {
  label: string;
  sub: string;
  on: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  const { T } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        ...(divider ? { borderTopWidth: 1, borderTopColor: T.bdL } : null),
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt s={14.5} w={700} c={T.t1}>
          {label}
        </Txt>
        <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
          {sub}
        </Txt>
      </View>
      <Toggle on={on} onPress={onPress} />
    </View>
  );
}

/** Barra de progresso arredondada. */
export function Bar({
  pct,
  color,
  height = 6,
  track,
}: {
  pct: number;
  color: string;
  height?: number;
  track?: string;
}) {
  const { T } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: 999,
        backgroundColor: track ?? T.bdL,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, pct))}%`,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Pílula selecionável (chips de emoção, tags do diário, vínculos…). */
export function Chip({
  label,
  on,
  onPress,
  variant = 'soft',
  style,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  /** `soft` usa o roxo claro; `solid` preenche com a cor primária. */
  variant?: 'soft' | 'solid';
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  const solid = variant === 'solid';
  return (
    <Touchable
      onPress={onPress}
      style={[
        {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 13,
          backgroundColor: on ? (solid ? T.pri : T.priL) : solid ? T.chipBg : T.bg,
          ...(solid ? { borderWidth: 1, borderColor: on ? T.pri : T.chipBd } : null),
        },
        style,
      ]}
    >
      <Txt s={12.5} w={700} c={on ? (solid ? '#fff' : T.pri) : T.t2}>
        {label}
      </Txt>
    </Touchable>
  );
}

/** Grupo segmentado em trilho arredondado (períodos, entrar/criar conta). */
export function Segmented({
  items,
  index,
  onChange,
  style,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  return (
    <View
      style={[
        { flexDirection: 'row', padding: 3, backgroundColor: T.bdL, borderRadius: 999 },
        style,
      ]}
    >
      {items.map((label, i) => {
        const on = i === index;
        return (
          <Touchable
            key={label}
            onPress={() => onChange(i)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              alignItems: 'center',
              backgroundColor: on ? T.surf : 'transparent',
              ...(on
                ? {
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : null),
            }}
          >
            <Txt s={13} w={700} c={on ? T.t1 : T.t3}>
              {label}
            </Txt>
          </Touchable>
        );
      })}
    </View>
  );
}

/** Botão principal, cheio, da cor primária. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingVertical: 16,
          borderRadius: 18,
          alignItems: 'center',
          backgroundColor: disabled ? T.bd : T.pri,
        },
        style,
      ]}
    >
      <Txt s={15} w={800} c={disabled ? T.t3 : '#fff'}>
        {label}
      </Txt>
    </Touchable>
  );
}

/* ── Animação de entrada de tela ────────────────────────────────────────── */

/** Reproduz as keyframes `mp-in1` / `mp-in2`: sobe 14px e aparece em 340 ms. */
export function Enter({
  seq,
  children,
  style,
}: {
  seq: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 340,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [seq, v]);

  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Largura de cada coluna numa grade que se estende de margem a margem.
 * Substitui os `width: calc(50% - 5px)` do design, que o RN não tem.
 */
export function useColumnWidth(columns: number, gap: number, margin = 16) {
  const { width } = useWindowDimensions();
  // Arredondar para baixo: a divisão exata não deixa folga, e o arredondamento
  // de subpixel do layout faz a última coluna quebrar para a linha seguinte.
  return Math.floor((width - margin * 2 - gap * (columns - 1)) / columns);
}

/** Loop 0→1 contínuo, base para as animações do bichinho. */
export function useLoop(duration: number, enabled = true) {
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!enabled) {
      v.setValue(0);
      return;
    }
    v.setValue(0);
    const anim = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [duration, enabled, v]);

  return v;
}
