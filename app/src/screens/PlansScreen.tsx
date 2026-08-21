import React from 'react';
import { View } from 'react-native';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { ScreenTitle, Touchable, Txt } from '../components/ui';
import { ICONS, PLANS } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';

export function PlansScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();

  return (
    <ScreenScroll>
      <ScreenTitle label="PLANOS" title={'Escolha o\nseu ritmo'} />

      <Section top={0} gap={10}>
        {PLANS.map(([id, name, price, per, feats, best]) => {
          const on = id === state.plan;
          return (
            <View
              key={id}
              style={{
                borderRadius: 22,
                padding: 18,
                backgroundColor: on ? T.priL : T.surf,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? T.pri : T.bd,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
                <Txt s={17} w={800} c={T.t1}>
                  {name}
                </Txt>
                {best ? (
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 9,
                      borderRadius: 999,
                      backgroundColor: T.pri,
                    }}
                  >
                    <Txt s={9.5} w={800} c="#fff" ls={0.6}>
                      MAIS ESCOLHIDO
                    </Txt>
                  </View>
                ) : null}
              </View>

              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}
              >
                <Txt s={27} w={800} c={T.t1} ls={-1}>
                  {price}
                </Txt>
                <Txt s={12} c={T.t3}>
                  {per}
                </Txt>
              </View>

              <View style={{ gap: 7, marginTop: 13 }}>
                {feats.map((f) => (
                  <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ marginTop: 2 }}>
                      <Icon d={ICONS.check} size={15} color={T.pri} sw={2.2} />
                    </View>
                    <Txt s={12.5} lh={1.5} c={T.t2} style={{ flex: 1 }}>
                      {f}
                    </Txt>
                  </View>
                ))}
              </View>

              <Touchable
                onPress={() => actions.set({ plan: id })}
                style={{
                  marginTop: 15,
                  paddingVertical: 13,
                  borderRadius: 15,
                  alignItems: 'center',
                  backgroundColor: on ? T.pri : T.bg,
                }}
              >
                <Txt s={13.5} w={800} c={on ? '#fff' : T.t2}>
                  {on ? 'Plano atual' : 'Escolher'}
                </Txt>
              </Touchable>
            </View>
          );
        })}
      </Section>

      <Section top={14}>
        <View
          style={{
            padding: 15,
            paddingHorizontal: 16,
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: T.bd,
          }}
        >
          <Txt s={12} lh={1.55} c={T.t3}>
            Escolas e clínicas têm licença própria, por turma ou por paciente. Cancele quando
            quiser.
          </Txt>
        </View>
      </Section>
    </ScreenScroll>
  );
}
