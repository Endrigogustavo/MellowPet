import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';

import { ICONS } from '../data/content';
import { EMOTIONS, type IdleAnim } from '../data/emotions';
import type { PetKey } from '../data/pets';
import { STAGE_SHAPE, stageForDays } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';
import { BRAND } from '../theme/palette';
import { Icon } from './Icon';
import {
  BubbleSvg,
  FOODS,
  FoodIllustration,
  PLAY_TRICKS,
  PetPaw,
  PlayBallSvg,
  SparkleStarSvg,
  type PlayTrick,
} from './PetActionProps';
import { PetFace, type PetMouthMode } from './PetFace';
import { Txt, useLoop, useReducedMotion } from './ui';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Interpola pares `[tempo, valor]` garantindo ordem monotônica crescente e mesmo tamanho. */
function normalizeStops<T>(stops: readonly (readonly [number, T])[]): [number[], T[]] {
  const sorted = [...stops]
    .map(([t, val]) => [Math.max(0, Math.min(1, t)), val] as [number, T])
    .sort((a, b) => a[0] - b[0]);
  const input: number[] = [];
  const output: T[] = [];
  for (const [t, val] of sorted) {
    const prev = input[input.length - 1];
    input.push(prev !== undefined && t <= prev ? Math.min(1, prev + 0.0001) : t);
    output.push(val);
  }
  return [input, output];
}

function kf(v: Animated.Value, stops: readonly (readonly [number, number])[]) {
  const [inputRange, outputRange] = normalizeStops(stops);
  return v.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
}

function kfDeg(v: Animated.Value, stops: readonly (readonly [number, string])[]) {
  const [inputRange, outputRange] = normalizeStops(stops);
  return v.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
}

/** Transformações equivalentes às keyframes `mp-float`, `mp-bounce`, … */
function idleTransform(kind: IdleAnim, v: Animated.Value, muted: boolean) {
  if (muted) return [];
  const at = (input: number[], output: number[]) =>
    v.interpolate({ inputRange: input, outputRange: output });

  switch (kind) {
    case 'float':
      return [
        { translateY: at([0, 0.5, 1], [0, -7, 0]) },
        { rotate: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-1deg', '0deg'] }) },
      ];
    case 'bounce':
      return [
        { translateY: at([0, 0.3, 0.6, 1], [0, -13, 0, 0]) },
        { scale: at([0, 0.3, 0.6, 1], [1, 1.025, 0.985, 1]) },
      ];
    case 'shake':
      return [
        { translateX: at([0, 0.2, 0.4, 0.6, 0.8, 1], [0, -6, 6, -4, 4, 0]) },
        {
          rotate: v.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 1],
            outputRange: ['0deg', '-1.6deg', '1.6deg', '0deg', '0deg'],
          }),
        },
      ];
    case 'pulse':
    default:
      return [{ scale: at([0, 0.5, 1], [1, 1.035, 1]) }];
  }
}

/** Transformações do corpo do animal durante comer, recusar por saciedade ou brincar. */
function actionPetTransforms(
  kind: 'feed' | 'refuse' | PlayTrick | null,
  prog: Animated.Value,
  u: number,
  reduced: boolean
) {
  if (!kind || reduced) return [];

  switch (kind) {
    case 'refuse':
      return [
        {
          translateX: kf(prog, [
            [0, 0],
            [0.12, -15],
            [0.26, 15],
            [0.40, -11],
            [0.54, 11],
            [0.68, -6],
            [0.82, 6],
            [0.92, -2],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.12, '-7.5deg'],
            [0.26, '7.5deg'],
            [0.40, '-5deg'],
            [0.54, '5deg'],
            [0.68, '-3deg'],
            [0.82, '3deg'],
            [0.92, '-1deg'],
            [1, '0deg'],
          ]),
        },
        {
          scaleX: kf(prog, [
            [0, 1],
            [0.12, 1.03],
            [0.26, 1.03],
            [0.40, 1.02],
            [0.54, 1.02],
            [1, 1],
          ]),
        },
      ];

    case 'feed':
      return [
        {
          translateY: kf(prog, [
            [0, 0],
            [0.15, -6],
            [0.21, 2],
            [0.29, -3],
            [0.37, 2],
            [0.46, -3],
            [0.54, 2],
            [0.63, -3],
            [0.72, 1],
            [0.84, -8],
            [0.94, 1.5],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.15, '0deg'],
            [0.24, '-2.4deg'],
            [0.4, '2.4deg'],
            [0.56, '-2.2deg'],
            [0.7, '1.8deg'],
            [0.84, '0deg'],
            [1, '0deg'],
          ]),
        },
        {
          scaleX: kf(prog, [
            [0, 1],
            [0.15, 0.97],
            [0.21, 1.045],
            [0.29, 0.975],
            [0.37, 1.04],
            [0.46, 0.975],
            [0.54, 1.035],
            [0.63, 0.98],
            [0.72, 1.02],
            [0.84, 0.97],
            [0.94, 1.02],
            [1, 1],
          ]),
        },
        {
          scaleY: kf(prog, [
            [0, 1],
            [0.15, 1.035],
            [0.21, 0.955],
            [0.29, 1.03],
            [0.37, 0.96],
            [0.46, 1.03],
            [0.54, 0.965],
            [0.63, 1.025],
            [0.72, 0.98],
            [0.84, 1.04],
            [0.94, 0.98],
            [1, 1],
          ]),
        },
      ];

    case 'spin360':
      return [
        {
          translateY: kf(prog, [
            [0, 0],
            [0.15, 9],
            [0.44, -30],
            [0.74, 5],
            [0.88, -3],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.15, '-10deg'],
            [0.72, '366deg'],
            [0.86, '357deg'],
            [1, '360deg'],
          ]),
        },
        {
          scaleX: kf(prog, [
            [0, 1],
            [0.15, 1.09],
            [0.44, 0.96],
            [0.74, 1.06],
            [0.88, 0.99],
            [1, 1],
          ]),
        },
        {
          scaleY: kf(prog, [
            [0, 1],
            [0.15, 0.9],
            [0.44, 1.05],
            [0.74, 0.94],
            [0.88, 1.01],
            [1, 1],
          ]),
        },
      ];

    case 'headerBall':
      return [
        {
          translateX: kf(prog, [
            [0, 0],
            [0.24, 4],
            [0.44, 0],
            [0.68, -5],
            [0.86, 0],
            [1, 0],
          ]),
        },
        {
          translateY: kf(prog, [
            [0, 0],
            [0.13, 7],
            [0.24, -16],
            [0.38, 4],
            [0.48, 0],
            [0.57, 7],
            [0.68, -18],
            [0.84, 4],
            [0.93, -3],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.13, '-3deg'],
            [0.24, '6deg'],
            [0.42, '0deg'],
            [0.57, '3deg'],
            [0.68, '-8deg'],
            [0.86, '0deg'],
            [1, '0deg'],
          ]),
        },
        {
          scaleX: kf(prog, [
            [0, 1],
            [0.13, 1.06],
            [0.24, 0.96],
            [0.38, 1.04],
            [0.57, 1.06],
            [0.68, 0.95],
            [0.84, 1.04],
            [1, 1],
          ]),
        },
        {
          scaleY: kf(prog, [
            [0, 1],
            [0.13, 0.93],
            [0.24, 1.05],
            [0.38, 0.96],
            [0.57, 0.93],
            [0.68, 1.06],
            [0.84, 0.96],
            [1, 1],
          ]),
        },
      ];

    case 'sixSeven':
      return [
        {
          translateX: kf(prog, [
            [0, 0],
            [0.18, -4],
            [0.38, 4],
            [0.58, -4],
            [0.78, 4],
            [0.9, 0],
            [1, 0],
          ]),
        },
        {
          translateY: kf(prog, [
            [0, 0],
            [0.18, -4],
            [0.28, 1],
            [0.38, -4],
            [0.48, 1],
            [0.58, -4],
            [0.68, 1],
            [0.78, -4],
            [0.9, -6],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.18, '-6deg'],
            [0.38, '6deg'],
            [0.58, '-6deg'],
            [0.78, '6deg'],
            [0.9, '0deg'],
            [1, '0deg'],
          ]),
        },
      ];

    case 'bubbleBoop':
      return [
        {
          translateX: kf(prog, [
            [0, 0],
            [0.2, -4 * u],
            [0.34, -12 * u],
            [0.48, 0],
            [0.66, 12 * u],
            [0.82, 0],
            [1, 0],
          ]),
        },
        {
          translateY: kf(prog, [
            [0, 0],
            [0.2, 5],
            [0.34, -15],
            [0.48, 3],
            [0.56, 5],
            [0.66, -17],
            [0.82, 4],
            [0.92, -4],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.34, '-9deg'],
            [0.48, '0deg'],
            [0.66, '9deg'],
            [0.84, '0deg'],
            [1, '0deg'],
          ]),
        },
      ];

    case 'starJuggle':
      return [
        {
          translateY: kf(prog, [
            [0, 0],
            [0.2, -4],
            [0.36, 2],
            [0.52, -5],
            [0.68, 2],
            [0.84, -6],
            [1, 0],
          ]),
        },
        {
          rotate: kfDeg(prog, [
            [0, '0deg'],
            [0.22, '-5deg'],
            [0.44, '5deg'],
            [0.66, '-5deg'],
            [0.84, '4deg'],
            [1, '0deg'],
          ]),
        },
      ];
  }
}

/** Camada de comidas alternadas, migalhinhas e patinhas segurando o lanche. */
function FeedOverlay({
  variant,
  prog,
  u,
  petType,
  petBody,
  petLine,
  accent,
  reduced,
}: {
  variant: number;
  prog: Animated.Value;
  u: number;
  petType: PetKey;
  petBody: string;
  petLine: string;
  accent: string;
  reduced: boolean;
}) {
  const food = FOODS[variant % FOODS.length];
  const mouthY = 29 * u;
  const pawX = 25 * u;

  if (reduced) {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          transform: [{ translateY: mouthY + 4 }],
          opacity: kf(prog, [
            [0, 0],
            [0.15, 1],
            [0.8, 1],
            [1, 0],
          ]),
        }}
      >
        <FoodIllustration id={food.id} size={40} />
      </Animated.View>
    );
  }

  const crumbs: { dx: number; dy: number; start: number; end: number; c: string; r: number }[] = [
    { dx: -18, dy: 22, start: 0.21, end: 0.48, c: food.crumb, r: 4.5 },
    { dx: 20, dy: 25, start: 0.23, end: 0.5, c: food.crumbAlt, r: 3.8 },
    { dx: -24, dy: 26, start: 0.39, end: 0.66, c: food.crumbAlt, r: 4 },
    { dx: 16, dy: 28, start: 0.42, end: 0.68, c: food.crumb, r: 4.4 },
    { dx: -10, dy: 24, start: 0.56, end: 0.8, c: food.crumb, r: 3.6 },
  ];

  return (
    <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
      {/* Comida que chega e diminui a cada mordida */}
      <Animated.View
        style={{
          position: 'absolute',
          opacity: kf(prog, [
            [0, 0],
            [0.08, 1],
            [0.64, 1],
            [0.74, 0],
            [1, 0],
          ]),
          transform: [
            {
              translateX: kf(prog, [
                [0, 44],
                [0.13, 6],
                [0.19, 0],
                [0.38, -2],
                [0.56, 2],
                [1, 0],
              ]),
            },
            {
              translateY: kf(prog, [
                [0, mouthY + 26],
                [0.13, mouthY - 3],
                [0.19, mouthY + 2],
                [0.74, mouthY + 3],
                [1, mouthY + 3],
              ]),
            },
            {
              scale: kf(prog, [
                [0, 0.88],
                [0.14, 1.04],
                [0.21, 0.78],
                [0.35, 0.76],
                [0.4, 0.52],
                [0.53, 0.5],
                [0.58, 0.28],
                [0.74, 0.2],
                [1, 0.2],
              ]),
            },
            {
              rotate: kfDeg(prog, [
                [0, '16deg'],
                [0.15, '0deg'],
                [0.22, '-11deg'],
                [0.4, '10deg'],
                [0.58, '-8deg'],
                [1, '-8deg'],
              ]),
            },
          ],
        }}
      >
        <FoodIllustration id={food.id} size={42} />
      </Animated.View>

      {/* Patinhas segurando o lanchinho perto da boca */}
      {(['left', 'right'] as const).map((side) => {
        const dir = side === 'left' ? -1 : 1;
        return (
          <Animated.View
            key={side}
            style={{
              position: 'absolute',
              opacity: kf(prog, [
                [0, 0],
                [0.14, 1],
                [0.68, 1],
                [0.82, 0],
                [1, 0],
              ]),
              transform: [
                {
                  translateX: kf(prog, [
                    [0, dir * (pawX + 12)],
                    [0.18, dir * pawX],
                    [0.4, dir * (pawX - 3)],
                    [0.68, dir * pawX],
                    [0.82, dir * (pawX + 10)],
                    [1, dir * (pawX + 10)],
                  ]),
                },
                {
                  translateY: kf(prog, [
                    [0, mouthY + 22],
                    [0.18, mouthY + 8],
                    [0.3, mouthY + 4],
                    [0.44, mouthY + 9],
                    [0.58, mouthY + 5],
                    [0.82, mouthY + 20],
                    [1, mouthY + 20],
                  ]),
                },
                {
                  rotate: kfDeg(prog, [
                    [0, '0deg'],
                    [0.18, `${dir * -16}deg`],
                    [0.68, `${dir * -12}deg`],
                    [1, '0deg'],
                  ]),
                },
                { scale: 0.82 },
              ],
            }}
          >
            <PetPaw petType={petType} body={petBody} line={petLine} side={side} size={36} />
          </Animated.View>
        );
      })}

      {/* Migalhinhas saltando durante as mordidas */}
      {crumbs.map((c, idx) => (
        <Animated.View
          key={idx}
          style={{
            position: 'absolute',
            width: c.r * 2,
            height: c.r * 2,
            borderRadius: c.r,
            backgroundColor: c.c,
            opacity: kf(prog, [
              [0, 0],
              [c.start - 0.01, 0],
              [c.start + 0.03, 1],
              [c.end, 0],
              [1, 0],
            ]),
            transform: [
              {
                translateX: kf(prog, [
                  [0, 0],
                  [c.start, 0],
                  [c.end, c.dx],
                  [1, c.dx],
                ]),
              },
              {
                translateY: kf(prog, [
                  [0, mouthY + 4],
                  [c.start, mouthY + 4],
                  [(c.start + c.end) / 2, mouthY - 2],
                  [c.end, mouthY + c.dy],
                  [1, mouthY + c.dy],
                ]),
              },
              {
                scale: kf(prog, [
                  [0, 0.6],
                  [c.start + 0.03, 1],
                  [c.end, 0.5],
                  [1, 0.5],
                ]),
              },
            ],
          }}
        />
      ))}

      {/* Coraçãozinho final de satisfação */}
      <Animated.View
        style={{
          position: 'absolute',
          opacity: kf(prog, [
            [0, 0],
            [0.72, 0],
            [0.8, 1],
            [1, 0],
          ]),
          transform: [
            { translateX: 24 * u },
            {
              translateY: kf(prog, [
                [0, -20 * u],
                [0.72, -20 * u],
                [1, -46 * u],
              ]),
            },
            {
              scale: kf(prog, [
                [0, 0.75],
                [0.72, 0.75],
                [0.82, 1.05],
                [1, 0.9],
              ]),
            },
          ],
        }}
      >
        <Icon d={ICONS.heart} size={20} color={accent} filled />
      </Animated.View>
    </View>
  );
}

/** Camada das 5 brincadeiras criativas que se alternam em "Brincar". */
function PlayOverlay({
  trick,
  prog,
  u,
  petType,
  petBody,
  petLine,
  priColor,
  surfColor,
  bdColor,
  reduced,
}: {
  trick: PlayTrick;
  prog: Animated.Value;
  u: number;
  petType: PetKey;
  petBody: string;
  petLine: string;
  priColor: string;
  surfColor: string;
  bdColor: string;
  reduced: boolean;
}) {
  if (reduced) {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          transform: [{ translateX: 36 * u }, { translateY: -26 * u }],
          opacity: kf(prog, [
            [0, 0],
            [0.15, 1],
            [0.85, 1],
            [1, 0],
          ]),
        }}
      >
        {trick === 'headerBall' ? (
          <PlayBallSvg size={34} accent={priColor} />
        ) : trick === 'bubbleBoop' ? (
          <BubbleSvg size={30} tint={priColor} />
        ) : (
          <SparkleStarSvg size={24} color="#FFD166" />
        )}
      </Animated.View>
    );
  }

  if (trick === 'spin360') {
    const stars = [
      { x: -46 * u, y: -32 * u, c: '#FFD166', s: 20 },
      { x: 46 * u, y: -28 * u, c: priColor, s: 18 },
      { x: -34 * u, y: 26 * u, c: BRAND.peach, s: 16 },
      { x: 38 * u, y: 24 * u, c: '#FFD166', s: 17 },
    ];
    return (
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {stars.map((st, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              opacity: kf(prog, [
                [0, 0],
                [0.24, 0],
                [0.42, 1],
                [0.86, 0],
                [1, 0],
              ]),
              transform: [
                {
                  translateX: kf(prog, [
                    [0, st.x * 0.45],
                    [0.24, st.x * 0.45],
                    [0.78, st.x],
                    [1, st.x],
                  ]),
                },
                {
                  translateY: kf(prog, [
                    [0, st.y * 0.45],
                    [0.24, st.y * 0.45],
                    [0.78, st.y],
                    [1, st.y],
                  ]),
                },
                {
                  scale: kf(prog, [
                    [0, 0.7],
                    [0.44, 1.1],
                    [0.86, 0.65],
                    [1, 0.65],
                  ]),
                },
              ],
            }}
          >
            <SparkleStarSvg size={st.s} color={st.c} />
          </Animated.View>
        ))}
      </View>
    );
  }

  if (trick === 'headerBall') {
    const contactY = Math.max(-92, -36 * u - 26);
    const apexY = Math.max(-118, contactY - 26);
    return (
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {/* Brilho de impacto das duas cabeceadas */}
        {[
          { t: 0.24, x: 5 },
          { t: 0.68, x: -10 },
        ].map((hit, idx) => (
          <Animated.View
            key={idx}
            style={{
              position: 'absolute',
              opacity: kf(prog, [
                [0, 0],
                [hit.t - 0.02, 0],
                [hit.t + 0.02, 1],
                [hit.t + 0.16, 0],
                [1, 0],
              ]),
              transform: [
                { translateX: hit.x },
                { translateY: contactY + 14 },
                {
                  scale: kf(prog, [
                    [0, 0.7],
                    [hit.t, 0.75],
                    [hit.t + 0.14, 1.35],
                    [1, 1.35],
                  ]),
                },
              ],
            }}
          >
            <SparkleStarSvg size={22} color="#FFD166" />
          </Animated.View>
        ))}

        {/* Bolinha fazendo duas embaixadinhas na cabeça */}
        <Animated.View
          style={{
            position: 'absolute',
            opacity: kf(prog, [
              [0, 0],
              [0.07, 1],
              [0.88, 1],
              [1, 0],
            ]),
            transform: [
              {
                translateX: kf(prog, [
                  [0, 52],
                  [0.24, 5],
                  [0.46, -6],
                  [0.68, -10],
                  [0.88, 38],
                  [1, 58],
                ]),
              },
              {
                translateY: kf(prog, [
                  [0, apexY - 4],
                  [0.15, contactY - 12],
                  [0.24, contactY],
                  [0.36, apexY + 4],
                  [0.46, apexY],
                  [0.57, apexY + 8],
                  [0.68, contactY],
                  [0.84, apexY - 2],
                  [1, apexY + 14],
                ]),
              },
              {
                scaleX: kf(prog, [
                  [0, 0.92],
                  [0.22, 1],
                  [0.24, 1.16],
                  [0.29, 0.96],
                  [0.66, 1],
                  [0.68, 1.16],
                  [0.73, 0.96],
                  [1, 0.96],
                ]),
              },
              {
                scaleY: kf(prog, [
                  [0, 0.92],
                  [0.22, 1],
                  [0.24, 0.85],
                  [0.29, 1.04],
                  [0.66, 1],
                  [0.68, 0.85],
                  [0.73, 1.04],
                  [1, 0.96],
                ]),
              },
              {
                rotate: kfDeg(prog, [
                  [0, '0deg'],
                  [0.24, '-75deg'],
                  [0.68, '-235deg'],
                  [1, '-430deg'],
                ]),
              },
            ],
          }}
        >
          <PlayBallSvg size={36} accent={priColor} />
        </Animated.View>
      </View>
    );
  }

  if (trick === 'sixSeven') {
    const pawX = 43 * u;
    const pawBaseY = 20 * u;
    return (
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {/* Patinha esquerda pesando o "6" */}
        <Animated.View
          style={{
            position: 'absolute',
            opacity: kf(prog, [
              [0, 0],
              [0.1, 1],
              [0.88, 1],
              [1, 0],
            ]),
            transform: [
              { translateX: -pawX },
              {
                translateY: kf(prog, [
                  [0, pawBaseY + 18],
                  [0.18, pawBaseY - 17],
                  [0.38, pawBaseY + 11],
                  [0.58, pawBaseY - 17],
                  [0.78, pawBaseY + 11],
                  [0.9, pawBaseY],
                  [1, pawBaseY + 16],
                ]),
              },
              {
                rotate: kfDeg(prog, [
                  [0, '0deg'],
                  [0.18, '-11deg'],
                  [0.38, '7deg'],
                  [0.58, '-11deg'],
                  [0.78, '7deg'],
                  [1, '0deg'],
                ]),
              },
              {
                scale: kf(prog, [
                  [0, 0.88],
                  [0.12, 1],
                  [0.88, 1],
                  [1, 0.88],
                ]),
              },
            ],
          }}
        >
          <PetPaw petType={petType} body={petBody} line={petLine} side="left" size={40} />
        </Animated.View>

        {/* Patinha direita pesando o "7" */}
        <Animated.View
          style={{
            position: 'absolute',
            opacity: kf(prog, [
              [0, 0],
              [0.1, 1],
              [0.88, 1],
              [1, 0],
            ]),
            transform: [
              { translateX: pawX },
              {
                translateY: kf(prog, [
                  [0, pawBaseY + 18],
                  [0.18, pawBaseY + 11],
                  [0.38, pawBaseY - 17],
                  [0.58, pawBaseY + 11],
                  [0.78, pawBaseY - 17],
                  [0.9, pawBaseY],
                  [1, pawBaseY + 16],
                ]),
              },
              {
                rotate: kfDeg(prog, [
                  [0, '0deg'],
                  [0.18, '-7deg'],
                  [0.38, '11deg'],
                  [0.58, '-7deg'],
                  [0.78, '11deg'],
                  [1, '0deg'],
                ]),
              },
              {
                scale: kf(prog, [
                  [0, 0.88],
                  [0.12, 1],
                  [0.88, 1],
                  [1, 0.88],
                ]),
              },
            ],
          }}
        >
          <PetPaw petType={petType} body={petBody} line={petLine} side="right" size={40} />
        </Animated.View>

        {/* Badges flutuantes suaves "6" e "7" acompanhando cada patinha */}
        {(
          [
            {
              digit: '6',
              x: -pawX - 2,
              yStops: [
                [0, pawBaseY - 14],
                [0.18, pawBaseY - 44],
                [0.38, pawBaseY - 20],
                [0.58, pawBaseY - 44],
                [0.78, pawBaseY - 20],
                [1, pawBaseY - 14],
              ] as const,
              opStops: [
                [0, 0],
                [0.1, 0.95],
                [0.36, 0.5],
                [0.58, 1],
                [0.86, 0.45],
                [1, 0],
              ] as const,
            },
            {
              digit: '7',
              x: pawX + 2,
              yStops: [
                [0, pawBaseY - 14],
                [0.18, pawBaseY - 20],
                [0.38, pawBaseY - 44],
                [0.58, pawBaseY - 20],
                [0.78, pawBaseY - 44],
                [1, pawBaseY - 14],
              ] as const,
              opStops: [
                [0, 0],
                [0.2, 0.45],
                [0.38, 1],
                [0.58, 0.5],
                [0.78, 1],
                [0.9, 0.45],
                [1, 0],
              ] as const,
            },
          ] as const
        ).map((b) => (
          <Animated.View
            key={b.digit}
            style={{
              position: 'absolute',
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: surfColor,
              borderWidth: 1,
              borderColor: bdColor,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: kf(prog, b.opStops),
              transform: [{ translateX: b.x }, { translateY: kf(prog, b.yStops) }],
            }}
          >
            <Txt s={13} w={800} c={priColor}>
              {b.digit}
            </Txt>
          </Animated.View>
        ))}
      </View>
    );
  }

  if (trick === 'bubbleBoop') {
    const bubbles = [
      { x: -24 * u, startY: 22 * u, popY: -4 * u, popAt: 0.35, tint: priColor, size: 30 },
      { x: 24 * u, startY: 24 * u, popY: -6 * u, popAt: 0.65, tint: '#74B9FF', size: 32 },
      { x: -4 * u, startY: -8 * u, popY: -40 * u, popAt: 0.8, tint: BRAND.rose, size: 24 },
    ];
    return (
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {bubbles.map((bb, i) => (
          <React.Fragment key={i}>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: kf(prog, [
                  [0, 0],
                  [0.1, 1],
                  [bb.popAt - 0.02, 1],
                  [bb.popAt + 0.04, 0],
                  [1, 0],
                ]),
                transform: [
                  { translateX: bb.x },
                  {
                    translateY: kf(prog, [
                      [0, bb.startY],
                      [bb.popAt, bb.popY],
                      [1, bb.popY - 8],
                    ]),
                  },
                  {
                    scale: kf(prog, [
                      [0, 0.86],
                      [bb.popAt - 0.02, 1],
                      [bb.popAt + 0.04, 1.32],
                      [1, 1.32],
                    ]),
                  },
                ],
              }}
            >
              <BubbleSvg size={bb.size} tint={bb.tint} />
            </Animated.View>

            <Animated.View
              style={{
                position: 'absolute',
                opacity: kf(prog, [
                  [0, 0],
                  [bb.popAt - 0.01, 0],
                  [bb.popAt + 0.02, 1],
                  [bb.popAt + 0.16, 0],
                  [1, 0],
                ]),
                transform: [
                  { translateX: bb.x },
                  { translateY: bb.popY },
                  {
                    scale: kf(prog, [
                      [0, 0.7],
                      [bb.popAt, 0.8],
                      [bb.popAt + 0.15, 1.3],
                      [1, 1.3],
                    ]),
                  },
                ],
              }}
            >
              <SparkleStarSvg size={18} color={bb.tint} />
            </Animated.View>
          </React.Fragment>
        ))}
      </View>
    );
  }

  // Trick 5: `starJuggle` — malabares com as patinhas e estrelas suaves
  const pawX = 33 * u;
  const pawY = 20 * u;
  const topY = Math.max(-96, -44 * u);
  const orbs = [
    {
      color: '#FFD166',
      xStops: [
        [0, -pawX],
        [0.36, 0],
        [0.68, pawX],
        [0.92, 0],
        [1, 0],
      ] as const,
      yStops: [
        [0, pawY],
        [0.36, topY],
        [0.68, pawY - 4],
        [0.92, topY + 14],
        [1, topY + 20],
      ] as const,
    },
    {
      color: BRAND.peach,
      xStops: [
        [0, pawX],
        [0.28, 0],
        [0.56, -pawX],
        [0.84, 0],
        [1, pawX * 0.5],
      ] as const,
      yStops: [
        [0, pawY - 6],
        [0.28, topY + 6],
        [0.56, pawY - 4],
        [0.84, topY + 4],
        [1, pawY],
      ] as const,
    },
    {
      color: priColor,
      xStops: [
        [0, 0],
        [0.24, pawX],
        [0.52, 0],
        [0.8, -pawX],
        [1, -pawX * 0.4],
      ] as const,
      yStops: [
        [0, topY + 8],
        [0.24, pawY - 4],
        [0.52, topY],
        [0.8, pawY - 4],
        [1, topY + 18],
      ] as const,
    },
  ];

  return (
    <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
      {(['left', 'right'] as const).map((side) => {
        const dir = side === 'left' ? -1 : 1;
        return (
          <Animated.View
            key={side}
            style={{
              position: 'absolute',
              opacity: kf(prog, [
                [0, 0],
                [0.1, 1],
                [0.88, 1],
                [1, 0],
              ]),
              transform: [
                { translateX: dir * pawX },
                {
                  translateY: kf(prog, [
                    [0, pawY + 14],
                    [0.2, side === 'left' ? pawY - 8 : pawY + 4],
                    [0.42, side === 'left' ? pawY + 4 : pawY - 8],
                    [0.64, side === 'left' ? pawY - 8 : pawY + 4],
                    [0.84, side === 'left' ? pawY + 4 : pawY - 8],
                    [1, pawY + 14],
                  ]),
                },
                { scale: 0.9 },
              ],
            }}
          >
            <PetPaw petType={petType} body={petBody} line={petLine} side={side} size={38} />
          </Animated.View>
        );
      })}

      {orbs.map((orb, idx) => (
        <Animated.View
          key={idx}
          style={{
            position: 'absolute',
            opacity: kf(prog, [
              [0, 0],
              [0.1, 1],
              [0.88, 1],
              [1, 0],
            ]),
            transform: [
              { translateX: kf(prog, orb.xStops) },
              { translateY: kf(prog, orb.yStops) },
              {
                rotate: kfDeg(prog, [
                  [0, '0deg'],
                  [1, '240deg'],
                ]),
              },
            ],
          }}
        >
          <SparkleStarSvg size={21} color={orb.color} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Coração que sobe e some — keyframe `mp-heart`. */
function Heart({ x, color }: { x: number; color: string }) {
  const [v] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      v.setValue(0.2);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [v, reduced]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 82,
        left: `${x}%`,
        opacity: v.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, -14, -88] }) },
          { scale: v.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.55, 1, 0.88] }) },
        ],
      }}
    >
      <Icon d={ICONS.heart} size={22} color={color} filled />
    </Animated.View>
  );
}

/** Halo: pulsa sozinho, ou acompanha o ritmo 4-4-4 da respiração guiada. */
function Halo({ color, breathing, phase }: { color: string; breathing: boolean; phase: number }) {
  const idle = useLoop(6000, !breathing);
  const [breath] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!breathing) return;
    const target = phase === 2 ? 0.9 : 1.15;
    Animated.timing(breath, {
      toValue: target,
      duration: 4000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [breathing, phase, breath]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 236,
        height: 236,
        borderRadius: 118,
        borderWidth: 1.2,
        borderColor: color,
        opacity: breathing
          ? 0.52
          : idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.14, 0.36, 0.14] }),
        transform: [
          {
            scale: breathing
              ? breath
              : idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.95, 1.05, 0.95] }),
          },
        ],
      }}
    />
  );
}

/** Quanto tempo o pet visitante fica na tela. */
const VISIT_MS = 20_000;

export function PetStage() {
  const { state, actions } = useApp();
  const { T, emo, emoColor, emoInk, emoLight, pet } = useTheme();
  const reduced = useReducedMotion();

  const growthStage = stageForDays(state.careDays);
  const u = 1.76 * STAGE_SHAPE[growthStage].scale;

  const idle = useLoop(emo.anim.duration);
  const [wobble] = useState(() => new Animated.Value(0));
  const [actionProg] = useState(() => new Animated.Value(0));
  const [mouthMode, setMouthMode] = useState<PetMouthMode | null>(null);
  const firstRender = useRef(true);

  const petAction = state.petAction;
  const activePlayTrick: PlayTrick | null =
    petAction?.kind === 'play' ? PLAY_TRICKS[petAction.variant % PLAY_TRICKS.length] : null;
  const activeMotionKind: 'feed' | 'refuse' | PlayTrick | null =
    petAction?.kind === 'feed'
      ? 'feed'
      : petAction?.kind === 'refuse'
        ? 'refuse'
        : activePlayTrick;

  // Orquestra e interrompe com segurança as animações de comer, recusar por saciedade e brincar.
  useEffect(() => {
    if (!petAction) {
      setMouthMode(null);
      return;
    }

    const { kind, seq, variant } = petAction;
    const trick = kind === 'play' ? PLAY_TRICKS[variant % PLAY_TRICKS.length] : null;
    const duration = reduced
      ? 550
      : kind === 'refuse'
        ? 850
        : kind === 'feed'
          ? 1950
          : trick === 'spin360'
            ? 1450
            : 1920;

    actionProg.stopAnimation();
    actionProg.setValue(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, mode: PetMouthMode | null) => {
      timers.push(setTimeout(() => setMouthMode(mode), ms));
    };

    if (kind === 'refuse') {
      setMouthMode('refuse');
    } else if (kind === 'feed') {
      setMouthMode('bite');
      at(Math.round(duration * 0.19), 'chewA');
      at(Math.round(duration * 0.32), 'chewB');
      at(Math.round(duration * 0.45), 'chewA');
      at(Math.round(duration * 0.58), 'chewB');
      at(Math.round(duration * 0.73), 'playGrin');
    } else if (trick === 'headerBall' || trick === 'bubbleBoop') {
      setMouthMode('boop');
      at(Math.round(duration * 0.74), 'playGrin');
    } else {
      setMouthMode('playGrin');
    }

    const anim = Animated.timing(actionProg, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: USE_NATIVE_DRIVER,
    });

    anim.start(({ finished }) => {
      if (finished) {
        setMouthMode(null);
        actions.clearPetAction(seq);
      }
    });

    return () => {
      anim.stop();
      timers.forEach(clearTimeout);
    };
  }, [petAction, reduced, actionProg, actions]);

  // Cada toque roda o `mp-wobble` reativo (240ms) e volta para a animação da emoção.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduced) return;
    wobble.setValue(0);
    Animated.timing(wobble, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [state.petting, wobble, reduced]);

  const [visit] = useState(() => new Animated.Value(0));
  const visitor = state.visitor;
  useEffect(() => {
    if (reduced) {
      visit.setValue(visitor ? 1 : 0);
      return;
    }
    Animated.spring(visit, {
      toValue: visitor ? 1 : 0,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [visitor, visit, reduced]);

  useEffect(() => {
    if (!visitor) return;
    const timer = setTimeout(() => actions.set({ visitor: null }), VISIT_MS);
    return () => clearTimeout(timer);
  }, [visitor, actions]);

  const phase = state.breathing ? Math.floor((state.breathTick % 12) / 4) : -1;
  const breathLabel =
    phase === 0 ? 'Inspire · 4s' : phase === 1 ? 'Segure · 4s' : 'Solte · 4s';
  const breathRound = Math.min(5, Math.floor(state.breathTick / 12) + 1);

  return (
    <View
      style={{
        height: 272,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ninho orgânico de fundo */}
      <View
        style={{
          position: 'absolute',
          width: 208,
          height: 208,
          borderRadius: 104,
          backgroundColor: emoLight,
        }}
      />
      <Halo color={emoColor} breathing={state.breathing} phase={phase} />

      {state.hearts.map((h) => (
        <Heart key={h.id} x={h.x} color={emoColor} />
      ))}

      {/* Grupo ancorado ao pet (acompanha deslocamento caso haja visitante) */}
      <Animated.View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { translateX: visit.interpolate({ inputRange: [0, 1], outputRange: [0, -62] }) },
            { scale: visit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
          ],
        }}
      >
        <Pressable
          onPress={actions.pet}
          accessibilityRole="button"
          accessibilityLabel={`Fazer carinho em ${state.petName}`}
          style={{ minWidth: 180, minHeight: 180, alignItems: 'center', justifyContent: 'center' }}
        >
          <Animated.View
            style={{
              transform: [
                ...idleTransform(emo.anim.kind, idle, Boolean(petAction)),
                ...actionPetTransforms(activeMotionKind, actionProg, u, reduced),
                {
                  rotate: wobble.interpolate({
                    inputRange: [0, 0.28, 0.62, 1],
                    outputRange: ['0deg', '-4deg', '2.8deg', '0deg'],
                  }),
                },
                {
                  scale: wobble.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [1, 1.045, 1],
                  }),
                },
              ],
            }}
          >
            <PetFace
              size={176}
              petType={state.petType}
              emotion={visitor || petAction ? 'happy' : state.petMood}
              body={pet.body}
              belly={pet.belly}
              line={pet.line}
              whisker={pet.whisker}
              blush={pet.blush}
              stage={growthStage}
              accessory={state.habits.equipped}
              mouthMode={mouthMode}
            />
          </Animated.View>
        </Pressable>

        {petAction?.kind === 'feed' ? (
          <FeedOverlay
            key={`feed-${petAction.seq}`}
            variant={petAction.variant}
            prog={actionProg}
            u={u}
            petType={state.petType}
            petBody={pet.body}
            petLine={pet.line}
            accent={emoColor}
            reduced={reduced}
          />
        ) : petAction?.kind === 'play' && activePlayTrick ? (
          <PlayOverlay
            key={`play-${petAction.seq}`}
            trick={activePlayTrick}
            prog={actionProg}
            u={u}
            petType={state.petType}
            petBody={pet.body}
            petLine={pet.line}
            priColor={T.pri}
            surfColor={T.surf}
            bdColor={T.bd}
            reduced={reduced}
          />
        ) : null}
      </Animated.View>

      {visitor ? (
        <>
          <Animated.View
            pointerEvents="none"
            accessibilityLabel={`${visitor.petName} veio visitar`}
            style={{
              position: 'absolute',
              transform: [
                { translateX: visit.interpolate({ inputRange: [0, 1], outputRange: [260, 70] }) },
              ],
            }}
          >
            <PetFace size={124} petType={visitor.petType} emotion="happy" stage={visitor.stage} />
          </Animated.View>
          <Heart x={-20} color={emoColor} />
          <Heart x={12} color={emoColor} />
          <Heart x={40} color={emoColor} />
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 8,
              maxWidth: 280,
              opacity: visit,
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
            }}
          >
            <Txt s={12.5} w={800} c={T.t1} numberOfLines={1}>
              {visitor.petName} veio visitar!
            </Txt>
          </Animated.View>
        </>
      ) : null}

      {state.breathing ? (
        <View style={{ position: 'absolute', bottom: 4, alignItems: 'center', gap: 1 }}>
          <Txt s={14.5} w={800} c={emoInk} ls={0.2}>
            {breathLabel}
          </Txt>
          <Txt s={11.5} c={T.t3}>
            ciclo {breathRound} de 5
          </Txt>
        </View>
      ) : state.signalStatus === 'ready' && state.secondaryEmotions.length > 0 && !petAction ? (
        <View style={{ position: 'absolute', bottom: 8, alignItems: 'center', paddingHorizontal: 18 }}>
          <Txt s={12} w={700} c={T.t3} numberOfLines={1}>
            + {state.secondaryEmotions
              .map((entry) => `${EMOTIONS[entry.expression].label.toLowerCase()} (${Math.round(entry.confidence * 100)}%)`)
              .join(' · ')}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
