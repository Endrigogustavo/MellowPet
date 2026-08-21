import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COACH } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';
import { Touchable, Txt } from './ui';

/** Tour de boas-vindas: três cartões sobre a Home. */
export function CoachOverlay() {
  const { state, actions } = useApp();
  const { T } = useTheme();

  const i = Math.min(state.coach, COACH.length - 1);
  const [title, text] = COACH[i];

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        padding: 20,
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(20,12,26,0.55)', 'rgba(20,12,26,0.3)', 'rgba(20,12,26,0)']}
        locations={[0, 0.32, 0.58]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          borderRadius: 24,
          backgroundColor: T.surf,
          padding: 20,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 18 },
          elevation: 12,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 14 }}>
          {COACH.map((_, d) => (
            <View
              key={d}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 999,
                backgroundColor: d <= state.coach ? T.pri : T.bd,
              }}
            />
          ))}
        </View>

        <Txt s={11} w={800} c={T.t3} ls={1.4}>
          PASSO {Math.min(state.coach + 1, COACH.length)} DE {COACH.length}
        </Txt>
        <Txt s={20} w={800} c={T.t1} ls={-0.5} style={{ marginTop: 7 }}>
          {title}
        </Txt>
        <Txt s={14} lh={1.6} c={T.t2} style={{ marginTop: 8 }}>
          {text}
        </Txt>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Touchable
            onPress={() => actions.set({ coach: COACH.length })}
            style={{ paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16 }}
          >
            <Txt s={13.5} w={700} c={T.t3}>
              Pular
            </Txt>
          </Touchable>
          <Touchable
            onPress={() => actions.set((s) => ({ coach: s.coach + 1 }))}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor: T.pri,
            }}
          >
            <Txt s={14} w={800} c="#fff">
              Entendi
            </Txt>
          </Touchable>
        </View>
      </View>
    </View>
  );
}
