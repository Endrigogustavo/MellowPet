import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  type Insets,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { showsBackButton } from '../navigation/navModel';
import { useApp, useTheme } from '../state/AppContext';
import { hapticTap } from '../theme/haptics';
import { LIGHT } from '../theme/palette';
import { font, type FontWeight } from '../theme/type';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Respeita `prefers-reduced-motion` no sistema e no navegador. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = () => setReduced(mq.matches);
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    }
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(Boolean(v));
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(Boolean(v)));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/* ── Texto ──────────────────────────────────────────────────────────────── */

type TxtProps = TextProps & {
  /** fontSize */
  s?: number;
  /** peso da fonte Nunito */
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

/** Rótulo contextual calmo (sem grito tipográfico em caixa alta espaçada). */
export function Eyebrow({ children, ls = 0 }: { children: React.ReactNode; ls?: number }) {
  const { T } = useTheme();
  const normalized =
    typeof children === 'string' && children === children.toUpperCase() && children.length > 2
      ? children.charAt(0) + children.slice(1).toLowerCase()
      : children;
  return (
    <Txt s={12.5} w={700} c={T.t3} ls={ls === 1.8 ? 0 : ls}>
      {normalized}
    </Txt>
  );
}

/** Cabeçalho de tela: botão voltar >= 44×44px + subtítulo opcional + título humano. */
export function ScreenTitle({
  label,
  title,
  onBack,
}: {
  label?: string;
  title: string;
  onBack?: () => void;
}) {
  const { T } = useTheme();
  const { state, actions } = useApp();
  // Abas do perfil atual não têm "voltar" (a barra de baixo já leva às
  // outras). Fora delas sempre há: sem histórico, volta para a inicial do
  // perfil — igual ao voltar físico.
  const canGoBack = Boolean(onBack) || showsBackButton(state.screen, state.role);
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
      {canGoBack ? (
        <Touchable
          onPress={() => (onBack ? onBack() : actions.back())}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          style={{
            minHeight: 44,
            minWidth: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginBottom: 6,
            alignSelf: 'flex-start',
            paddingRight: 10,
          }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={T.pri}
              strokeWidth={2.3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Txt s={13.5} w={700} c={T.pri}>
            Voltar
          </Txt>
        </Touchable>
      ) : null}
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      <Txt s={29} w={800} c={T.t1} ls={-0.8} lh={1.14} style={{ marginTop: label ? 4 : 0 }}>
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
  variant?: 'elevated' | 'warm' | 'flat';
};

export function Card({
  children,
  style,
  bg,
  radius = 22,
  padding = 18,
  bordered = true,
  variant = 'elevated',
}: CardProps) {
  const { T, isDark } = useTheme();
  const surfaceBg = bg ?? (variant === 'warm' ? T.surfWarm : T.surf);
  const showBorder = bordered && !bg && variant !== 'warm';
  return (
    <View
      style={[
        {
          backgroundColor: surfaceBg,
          borderRadius: radius,
          padding,
          ...(showBorder ? { borderWidth: 1, borderColor: variant === 'elevated' ? T.bdL : T.bd } : null),
          ...(variant === 'elevated' && !bg
            ? {
                shadowColor: T.shadow,
                shadowOpacity: isDark ? 0.2 : 0.035,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 1,
              }
            : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const WEB_PRESSABLE_STYLE =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        cursor: 'pointer',
        transitionProperty: 'transform, opacity',
        transitionDuration: '130ms',
        transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
      } as unknown as ViewStyle)
    : null;

/** Área mínima de toque recomendada (WCAG 2.5.5 / Material / HIG). */
export const MIN_TOUCH = 44;

/** Folga que falta para um eixo de `size` dp chegar a {@link MIN_TOUCH}. */
function slopFor(size: number): number {
  return size > 0 && size < MIN_TOUCH ? Math.ceil((MIN_TOUCH - size) / 2) : 0;
}

type TouchableProps = PressableProps & { style?: StyleProp<ViewStyle>; scaleOnPress?: boolean };

/**
 * Botão genérico com micro-resposta tátil (escala 0.975 + opacidade sutil).
 *
 * - Papel `button` por padrão (passe `accessibilityRole` para trocar).
 * - `disabled` vai para `accessibilityState`, junto com o estado que vier.
 * - Sem `hitSlop` explícito, mede o próprio tamanho e estende a área de toque
 *   até 44×44 sem mexer no layout.
 * - A opacidade do `style` (ex.: item apagado) é multiplicada pelo feedback de
 *   toque em vez de anulá-lo.
 */
export function Touchable({
  style,
  scaleOnPress = true,
  accessibilityRole = 'button',
  accessibilityState,
  disabled,
  hitSlop,
  onLayout,
  ...rest
}: TouchableProps) {
  const reduced = useReducedMotion();
  const [slop, setSlop] = useState<Insets | undefined>(undefined);
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const baseOpacity = typeof flat?.opacity === 'number' ? flat.opacity : 1;

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayout?.(e);
    if (hitSlop !== undefined) return;
    const { width, height } = e.nativeEvent.layout;
    const h = slopFor(width);
    const v = slopFor(height);
    setSlop((prev) => {
      if (prev && prev.left === h && prev.top === v) return prev;
      return h || v ? { left: h, right: h, top: v, bottom: v } : undefined;
    });
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      hitSlop={hitSlop ?? slop}
      onLayout={handleLayout}
      style={({ pressed }) => {
        const down = pressed && !disabled;
        return [
          WEB_PRESSABLE_STYLE,
          scaleOnPress && !reduced ? { transform: [{ scale: down ? 0.975 : 1 }] } : null,
          style,
          { opacity: baseOpacity * (down ? 0.86 : 1) },
        ];
      }}
    />
  );
}

/**
 * Ação só de texto ("Tentar novamente", "Remover", "Depois"…) com altura mínima
 * de 44 px. Use no lugar de um `Touchable` com `Txt` solto.
 */
export function LinkButton({
  label,
  onPress,
  color,
  size = 12.5,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={[
        { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 8, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Txt s={size} w={800} c={color ?? T.pri}>
        {label}
      </Txt>
    </Touchable>
  );
}

/* ── Controles ──────────────────────────────────────────────────────────── */

/**
 * Interruptor 50×29 do design. `label` é o que o leitor de tela anuncia
 * ("Lembrete de Água, interruptor, ligado").
 */
export function Toggle({
  on,
  onPress,
  label,
  hint,
  disabled,
}: {
  on: boolean;
  onPress: () => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    if (reduced) {
      v.setValue(on ? 1 : 0);
      return;
    }
    Animated.timing(v, {
      toValue: on ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [on, reduced, v]);

  return (
    <Touchable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={8}
      style={{ minHeight: 44, minWidth: 50, justifyContent: 'center' }}
    >
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
            // Ligado, a bolinha fica sobre `pri`: usa `onPri` (branco some no lilás escuro).
            backgroundColor: on ? T.onPri : LIGHT.surf,
            shadowColor: T.shadow,
            shadowOpacity: 0.18,
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
        minHeight: 56,
        paddingVertical: 14,
        ...(divider ? { borderTopWidth: 1, borderTopColor: T.bdL } : null),
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt s={14.5} w={700} c={T.t1}>
          {label}
        </Txt>
        <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
          {sub}
        </Txt>
      </View>
      <Toggle on={on} onPress={onPress} label={label} hint={sub} />
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

/** Pílula selecionável com altura mínima tátil de 44px. */
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
  /** `soft` usa o tom lavanda suave; `solid` preenche com a cor primária. */
  variant?: 'soft' | 'solid';
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  const solid = variant === 'solid';
  return (
    <Touchable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: 15,
          paddingVertical: 10,
          borderRadius: 14,
          justifyContent: 'center',
          backgroundColor: on ? (solid ? T.pri : T.priL) : solid ? T.chipBg : T.surfWarm,
          ...(solid ? { borderWidth: 1, borderColor: on ? T.pri : T.chipBd } : null),
        },
        style,
      ]}
    >
      <Txt s={13} w={700} c={on ? (solid ? T.onPri : T.pri) : T.t2} numberOfLines={1}>
        {label}
      </Txt>
    </Touchable>
  );
}

/** Grupo segmentado em trilho arredondado (altura mínima 44px por aba). */
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
      accessibilityRole="tablist"
      style={[
        { flexDirection: 'row', padding: 4, backgroundColor: T.surfWarm, borderRadius: 16 },
        style,
      ]}
    >
      {items.map((label, i) => {
        const on = i === index;
        return (
          <Touchable
            key={label}
            onPress={() => {
              hapticTap();
              onChange(i);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={{
              flex: 1,
              minHeight: 44,
              paddingVertical: 11,
              paddingHorizontal: 10,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? T.surf : 'transparent',
              ...(on
                ? {
                    shadowColor: T.shadow,
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : null),
            }}
          >
            {/* t2: o t3 sobre o trilho `bdL` fica abaixo de 4,5:1 no claro. */}
            <Txt s={13} w={700} c={on ? T.t1 : T.t2} numberOfLines={1}>
              {label}
            </Txt>
          </Touchable>
        );
      })}
    </View>
  );
}

/** Botão principal, cheio, com contraste semântico (`T.onPri`) e altura >= 52px. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Mostra um indicador no lugar do rótulo, trava o toque e anuncia "ocupado". */
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  const off = disabled || loading;
  return (
    <Touchable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      disabled={off}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!loading }}
      style={[
        {
          minHeight: 52,
          paddingVertical: 15,
          paddingHorizontal: 20,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: disabled ? T.bd : T.pri,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={T.onPri} />
      ) : (
        <Txt s={15} w={800} c={disabled ? T.t3 : T.onPri} numberOfLines={1}>
          {label}
        </Txt>
      )}
    </Touchable>
  );
}

/* ── Animação de entrada de tela ────────────────────────────────────────── */

/** Entrada reativa e sutil (180ms cubic-out), respeitando movimento reduzido. */
export function Enter({
  seq,
  children,
  style,
}: {
  seq: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  const prevSeq = useRef(seq);

  useEffect(() => {
    if (prevSeq.current === seq) return;
    prevSeq.current = seq;
    if (reduced) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [reduced, seq, v]);

  return (
    <Animated.View
      style={[
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
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
 */
export function useColumnWidth(columns: number, gap: number, margin = 18) {
  const { width } = useWindowDimensions();
  return Math.max(120, Math.floor((width - margin * 2 - gap * (columns - 1)) / columns));
}

/** Loop contínuo 0 a 1 para animações orgânicas do bichinho (respeita movimento reduzido). */
export function useLoop(duration: number, enabled = true) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!enabled || reduced) {
      v.setValue(0);
      return;
    }
    v.setValue(0);
    const anim = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [duration, enabled, reduced, v]);

  return v;
}
