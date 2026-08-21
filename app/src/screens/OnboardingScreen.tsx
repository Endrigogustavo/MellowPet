import React from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MellowMark } from '../components/PetFace';
import { Toggle, Touchable, Txt, useLoop } from '../components/ui';
import { ONBOARDING } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';

export function OnboardingScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full, emoColor, emoLight } = useTheme();
  const insets = useSafeAreaInsets();
  const float = useLoop(5000);

  const [title, body] = ONBOARDING[state.onb];
  const isLast = state.onb === 2;

  const densityButton = (label: string, on: boolean, onPress: () => void) => (
    <Touchable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: on ? T.priL : T.bg,
      }}
    >
      <Txt s={13} w={700} c={on ? T.pri : T.t2}>
        {label}
      </Txt>
    </Touchable>
  );

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 16,
        paddingBottom: Math.max(insets.bottom, 16) + 14,
        paddingHorizontal: 26,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 34 }}>
        {ONBOARDING.map((_, i) => (
          <View
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 999,
              backgroundColor: i <= state.onb ? T.pri : T.bd,
            }}
          />
        ))}
      </View>

      <View style={{ flex: 1, alignItems: 'center', gap: 20 }}>
        <Animated.View
          style={{
            width: 132,
            height: 132,
            borderRadius: 44,
            backgroundColor: emoLight,
            alignItems: 'center',
            justifyContent: 'center',
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
          <MellowMark size={86} color={emoColor} faceColor={T.surf} />
        </Animated.View>

        <Txt s={31} w={800} c={T.t1} ls={-0.9} lh={1.15} center>
          {title}
        </Txt>
        <Txt s={15.5} lh={1.65} c={T.t2} center style={{ maxWidth: 290 }}>
          {body}
        </Txt>

        {isLast ? (
          <View
            style={{
              width: '100%',
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              borderRadius: 20,
              padding: 16,
              gap: 11,
              marginTop: 6,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Txt s={14} w={700} c={T.t1}>
                Tema escuro
              </Txt>
              <Toggle on={isDark} onPress={actions.toggleTheme} />
            </View>
            <View style={{ height: 1, backgroundColor: T.bd }} />
            <Txt s={14} w={700} c={T.t1}>
              Quanta informação você quer ver?
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {densityButton('Simples', !full, () => actions.set({ density: 'simples' }))}
              {densityButton('Completo', full, () => actions.set({ density: 'completo' }))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        <Touchable
          onPress={() => actions.go('home')}
          style={{ paddingHorizontal: 20, paddingVertical: 16, borderRadius: 18 }}
        >
          <Txt s={14} w={700} c={T.t3}>
            Pular
          </Txt>
        </Touchable>
        <Touchable
          onPress={() =>
            isLast ? actions.go('home') : actions.set((s) => ({ onb: s.onb + 1 }))
          }
          style={{
            flex: 1,
            paddingVertical: 16,
            borderRadius: 18,
            alignItems: 'center',
            backgroundColor: T.pri,
          }}
        >
          <Txt s={15} w={800} c="#fff">
            {isLast ? 'Entrar' : 'Continuar'}
          </Txt>
        </Touchable>
      </View>
    </View>
  );
}
