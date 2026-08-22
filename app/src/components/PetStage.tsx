import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { EMOTIONS, type IdleAnim } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { PetFace } from './PetFace';
import { Txt, useLoop } from './ui';

/** Transformações equivalentes às keyframes `mp-float`, `mp-bounce`, … */
function idleTransform(kind: IdleAnim, v: Animated.Value) {
  const at = (input: number[], output: (number | string)[]) =>
    v.interpolate({ inputRange: input, outputRange: output as number[] });

  switch (kind) {
    case 'float':
      return [
        { translateY: at([0, 0.5, 1], [0, -9, 0]) },
        { rotate: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-1.2deg', '0deg'] }) },
      ];
    case 'bounce':
      return [
        { translateY: at([0, 0.3, 0.6, 1], [0, -16, 0, 0]) },
        { scale: at([0, 0.3, 0.6, 1], [1, 1.03, 0.98, 1]) },
      ];
    case 'shake':
      return [
        { translateX: at([0, 0.2, 0.4, 0.6, 0.8, 1], [0, -7, 7, -5, 5, 0]) },
        {
          rotate: v.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 1],
            outputRange: ['0deg', '-2deg', '2deg', '0deg', '0deg'],
          }),
        },
      ];
    case 'pulse':
    default:
      return [{ scale: at([0, 0.5, 1], [1, 1.05, 1]) }];
  }
}

/** Coração que sobe e some — keyframe `mp-heart`. */
function Heart({ x, color }: { x: number; color: string }) {
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 1250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [v]);

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 76,
        left: `${x}%`,
        fontSize: 22,
        color,
        opacity: v.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, -14, -96] }) },
          { scale: v.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.5, 1, 0.85] }) },
        ],
      }}
    >
      ♥
    </Animated.Text>
  );
}

/** Halo: pulsa sozinho, ou acompanha o ritmo 4-4-4 da respiração guiada. */
function Halo({ color, breathing, phase }: { color: string; breathing: boolean; phase: number }) {
  const idle = useLoop(6000, !breathing);
  const [breath] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!breathing) return;
    // Inspirar e segurar mantêm o halo cheio; soltar encolhe.
    const target = phase === 2 ? 0.9 : 1.16;
    Animated.timing(breath, {
      toValue: target,
      duration: 4000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [breathing, phase, breath]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 232,
        height: 232,
        borderRadius: 116,
        borderWidth: 1,
        borderColor: color,
        opacity: breathing
          ? 0.5
          : idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.42, 0.18] }),
        transform: [
          {
            scale: breathing
              ? breath
              : idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.94, 1.06, 0.94] }),
          },
        ],
      }}
    />
  );
}

export function PetStage() {
  const { state, actions } = useApp();
  const { emo, emoColor, emoLight, pet } = useTheme();
  const { T } = useTheme();

  const idle = useLoop(emo.anim.duration);
  const [wobble] = useState(() => new Animated.Value(0));
  const firstRender = useRef(true);

  // Cada toque roda o `mp-wobble` uma vez e volta para a animação da emoção.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    wobble.setValue(0);
    Animated.timing(wobble, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [state.petting, wobble]);

  const phase = state.breathing ? Math.floor((state.breathTick % 12) / 4) : -1;
  const breathLabel =
    phase === 0 ? 'Inspire · 4s' : phase === 1 ? 'Segure · 4s' : 'Solte · 4s';
  const breathRound = Math.min(5, Math.floor(state.breathTick / 12) + 1);

  return (
    <View
      style={{
        height: 238,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: 198,
          height: 198,
          borderRadius: 99,
          backgroundColor: emoLight,
        }}
      />
      <Halo color={emoColor} breathing={state.breathing} phase={phase} />

      {state.hearts.map((h) => (
        <Heart key={h.id} x={h.x} color={emoColor} />
      ))}

      <Pressable onPress={actions.pet} accessibilityRole="button" accessibilityLabel="Fazer carinho">
        <Animated.View
          style={{
            transform: [
              ...idleTransform(emo.anim.kind, idle),
              {
                rotate: wobble.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: ['0deg', '-5deg', '4deg', '-2deg', '0deg'],
                }),
              },
              {
                scale: wobble.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [1, 1.05, 1.04, 1.02, 1],
                }),
              },
            ],
          }}
        >
          <PetFace
            size={172}
            petType={state.petType}
            emotion={state.petMood}
            body={pet.body}
            belly={pet.belly}
            whisker={pet.whisker}
            blush={pet.blush}
          />
        </Animated.View>
      </Pressable>

      {state.breathing ? (
        <View style={{ position: 'absolute', bottom: 10, alignItems: 'center', gap: 3 }}>
          <Txt s={15} w={800} c={emoColor} ls={0.3}>
            {breathLabel}
          </Txt>
          <Txt s={12} c={T.t3}>
            ciclo {breathRound} de 5
          </Txt>
        </View>
      ) : state.signalStatus === 'ready' && state.secondaryEmotions.length > 0 ? (
        <View style={{ position: 'absolute', bottom: 10, alignItems: 'center' }}>
          <Txt s={12} w={700} c={T.t3}>
            + {state.secondaryEmotions
              .map((entry) => `${EMOTIONS[entry.expression].label.toLowerCase()} (${Math.round(entry.confidence * 100)}%)`)
              .join(' + ')}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
