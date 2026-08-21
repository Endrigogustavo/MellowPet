import React from 'react';
import { View } from 'react-native';

import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { HABITS, ROUTINE } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';

export function RoutineScreen() {
  const { state, actions } = useApp();
  const { T, emoColor } = useTheme();

  return (
    <ScreenScroll>
      <ScreenTitle label="ROTINA" title={'O seu dia,\nem blocos'} />

      <Section top={0}>
        <Card radius={24} padding={18} style={{ gap: 14 }}>
          {ROUTINE.map(([time, name, stateLabel, color]) => (
            <View key={time} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Txt s={12} w={800} c={T.t3} style={{ width: 44 }}>
                {time}
              </Txt>
              <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color }} />
              <Txt s={13.5} c={T.t1} style={{ flex: 1 }}>
                {name}
              </Txt>
              <Txt s={11} w={800} c={color} ls={0.5} caps>
                {stateLabel}
              </Txt>
            </View>
          ))}
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 14 }}>
            Hábitos da semana
          </Txt>
          <View style={{ gap: 12 }}>
            {HABITS.map(([name, done, total]) => (
              <View key={name}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <Txt s={12.5} c={T.t1}>
                    {name}
                  </Txt>
                  <Txt s={11.5} w={800} c={T.t3}>
                    {done}/{total}
                  </Txt>
                </View>
                <View style={{ marginTop: 6 }}>
                  <Bar pct={Math.round((done / total) * 100)} color={emoColor} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      {/* cápsula do tempo */}
      <Section>
        <View style={{ borderRadius: 24, padding: 18, backgroundColor: T.priL }}>
          <Txt s={13.5} w={800} c={T.pri}>
            Cápsula do tempo
          </Txt>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
            Escreva algo para você ler em 30 dias. Fica selado até lá.
          </Txt>
          <Field
            value={state.capsule}
            onChangeText={(capsule) => actions.set({ capsule })}
            placeholder="Daqui a um mês eu espero…"
            containerStyle={{ marginTop: 12 }}
            style={{ backgroundColor: T.surf, borderWidth: 0, borderRadius: 14, paddingVertical: 13 }}
          />
          <Touchable
            onPress={() => actions.set({ capsuleSaved: true })}
            style={{
              marginTop: 10,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: state.capsuleSaved ? T.bg : T.pri,
            }}
          >
            <Txt s={13.5} w={800} c={state.capsuleSaved ? T.t2 : '#fff'}>
              {state.capsuleSaved ? 'Guardado para daqui a 30 dias' : 'Selar por 30 dias'}
            </Txt>
          </Touchable>
        </View>
      </Section>
    </ScreenScroll>
  );
}
