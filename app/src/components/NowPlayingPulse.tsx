import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * Indicador de "esta é a faixa que está tocando".
 *
 * Barras que sobem e descem em ritmos ligeiramente diferentes — o
 * descompasso é o que faz parecer som, e não um relógio. Quando pausado,
 * as barras baixam e ficam paradas: o mesmo elemento diz "tocando" e
 * "pausado" sem trocar de ícone.
 *
 * Diferente do equalizador dos widgets, aqui a animação roda de verdade:
 * dentro do app existe `Animated`, sem a limitação de RemoteViews.
 */

/** Períodos do design: 0.7 + i*0.16s. */
const PERIODS = [700, 860, 1020, 1180];
const DELAYS = [0, 100, 200, 300];

function Bar({
  index,
  playing,
  color,
  height,
}: {
  index: number;
  playing: boolean;
  color: string;
  height: number;
}) {
  const v = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (!playing) {
      Animated.timing(v, {
        toValue: 0.25,
        duration: 220,
        easing: Easing.out(Easing.quad),
        // height não é animável pelo driver nativo.
        useNativeDriver: false,
      }).start();
      return;
    }

    const half = PERIODS[index % PERIODS.length] / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(v, {
          toValue: 0.28,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    // O atraso é o que tira o sincronismo entre as barras.
    const timer = setTimeout(() => loop.start(), DELAYS[index % DELAYS.length]);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [playing, index, v]);

  return (
    <Animated.View
      style={{
        width: 3,
        borderRadius: 999,
        backgroundColor: color,
        height: v.interpolate({ inputRange: [0, 1], outputRange: [3, height] }),
      }}
    />
  );
}

export function NowPlayingPulse({
  playing,
  color,
  size = 18,
  bars = 4,
}: {
  playing: boolean;
  color: string;
  /** Altura máxima das barras. */
  size?: number;
  bars?: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2.5,
        height: size,
      }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} index={i} playing={playing} color={color} height={size} />
      ))}
    </View>
  );
}
