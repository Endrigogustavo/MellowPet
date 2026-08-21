import React from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { Touchable, Txt, useLoop } from '../components/ui';
import { HEAD } from '../data/pets';
import { useApp } from '../state/AppContext';

const INK = '#4A3550';
const CREAM = '#FAF6F2';

const SPLASH_WHISKERS = [
  'M 34 65 L 15 60',
  'M 34 68 L 13 68',
  'M 34 71 L 16 76',
  'M 66 65 L 85 60',
  'M 66 68 L 87 68',
  'M 66 71 L 84 76',
];

/** A foca da marca: olhos fechados, focinho e bigodes. */
function SplashMellow({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={HEAD} fill={CREAM} />
      <Ellipse cx={50} cy={68} rx={18} ry={12.5} fill={INK} opacity={0.1} />
      <G fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" opacity={0.6}>
        {SPLASH_WHISKERS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
      <G fill="none" stroke={INK} strokeWidth={4.2} strokeLinecap="round">
        <Path d="M 30 51 q 7 -9 14 0" />
        <Path d="M 56 51 q 7 -9 14 0" />
      </G>
      <Path d="M 44.5 58 Q 50 55.5 55.5 58 Q 55 64.5 50 67 Q 45 64.5 44.5 58 Z" fill={INK} />
      <G fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round">
        <Path d="M 50 67 Q 50 72 44 72" />
        <Path d="M 50 67 Q 50 72 56 72" />
      </G>
    </Svg>
  );
}

/** Brilho radial de fundo — keyframe `mp-sheen`. */
function Sheen() {
  const v = useLoop(9000);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.6, 0.35] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-31, 31, -31] }) },
          { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-21, 21, -21] }) },
          { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) },
        ],
      }}
    >
      <Svg width={520} height={520} viewBox="0 0 520 520">
        <Defs>
          <RadialGradient id="sheen" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFC9A8" stopOpacity={0.55} />
            <Stop offset="42%" stopColor="#F3AEB6" stopOpacity={0.32} />
            <Stop offset="72%" stopColor="#C6A9F0" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={260} cy={260} r={260} fill="url(#sheen)" />
      </Svg>
    </Animated.View>
  );
}

export function SplashScreen() {
  const { actions } = useApp();
  const float = useLoop(5500);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: INK,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        overflow: 'hidden',
      }}
    >
      <Sheen />

      <Animated.View
        style={{
          transform: [
            { translateY: float.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -9, 0] }) },
            {
              rotate: float.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ['0deg', '-1.2deg', '0deg'],
              }),
            },
          ],
        }}
      >
        <SplashMellow size={164} />
      </Animated.View>

      <View style={{ alignItems: 'center' }}>
        <Txt s={46} w={800} c={CREAM} ls={-1.6} lh={1}>
          mellowpet
        </Txt>
        <Txt s={11} w={700} c="rgba(250,246,242,0.62)" ls={3} style={{ marginTop: 12 }}>
          PERCEBE ANTES DE VOCÊ
        </Txt>
      </View>

      <Touchable
        onPress={() => actions.go('login')}
        style={{
          marginTop: 16,
          paddingVertical: 15,
          paddingHorizontal: 46,
          borderRadius: 999,
          backgroundColor: CREAM,
        }}
      >
        <Txt s={15} w={800} c={INK}>
          Começar
        </Txt>
      </Touchable>
    </View>
  );
}
