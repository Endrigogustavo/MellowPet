import React from 'react';
import { View } from 'react-native';

import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, ScreenTitle, Touchable, Txt, useColumnWidth } from '../components/ui';
import { stageForDays } from '../pet/growth';
import { ACCESSORIES, TRAIT_LABEL, personality } from '../pet/habits';
import { useApp, useTheme } from '../state/AppContext';

/**
 * Guarda-roupa: acessórios ganhos por constância, nunca comprados. Cada um
 * mostra o hábito que o libera e quanto falta — é um mapa de autocuidado
 * disfarçado de enfeite.
 */
export function WardrobeScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const cell = useColumnWidth(2, 10);
  const h = state.habits;
  const traits = personality(h);
  const stage = stageForDays(state.careDays);

  return (
    <ScreenScroll>
      <ScreenTitle label="GUARDA-ROUPA" title={`O jeito do\n${state.petName}`} />

      <Section top={4}>
        <Card radius={24} padding={18} style={{ alignItems: 'center' }}>
          <PetFace size={120} petType={state.petType} emotion="happy" stage={stage} accessory={h.equipped} />
          <Txt s={13} w={800} c={T.t1} style={{ marginTop: 8 }}>
            {traits
              ? `${state.petName} é ${traits.map((t) => TRAIT_LABEL[t]).join(' e ')}`
              : `${state.petName} ainda está descobrindo o próprio jeito`}
          </Txt>
          <Txt s={11.5} lh={1.5} c={T.t3} center style={{ marginTop: 4 }}>
            A personalidade vem do jeito como vocês passam o tempo juntos.
          </Txt>
        </Card>
      </Section>

      <Section>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {ACCESSORIES.map((a) => {
            const [done, goal] = a.progress(h);
            const unlocked = done >= goal;
            const on = h.equipped === a.id;
            return (
              <Touchable
                key={a.id}
                disabled={!unlocked}
                onPress={() => actions.equip(on ? null : a.id)}
                accessibilityLabel={unlocked ? `${on ? 'Tirar' : 'Vestir'} ${a.label}` : `${a.label}, bloqueado`}
                accessibilityState={{ selected: on, disabled: !unlocked }}
                style={{ width: cell }}
              >
                <Card
                  radius={20}
                  padding={12}
                  style={{ alignItems: 'center', borderColor: on ? T.pri : T.bd, borderWidth: on ? 2 : 1 }}
                >
                  <View style={{ opacity: unlocked ? 1 : 0.35 }}>
                    <PetFace size={64} petType={state.petType} emotion="neutral" stage={stage} accessory={a.id} />
                  </View>
                  <Txt s={12.5} w={800} c={T.t1} style={{ marginTop: 4 }}>
                    {a.label}
                  </Txt>
                  <Txt s={11} lh={1.4} c={T.t3} center>
                    {unlocked ? (on ? 'vestindo' : 'toque para vestir') : a.how}
                  </Txt>
                  {!unlocked ? (
                    <View style={{ alignSelf: 'stretch', marginTop: 6 }}>
                      <Bar pct={(Math.min(done, goal) / goal) * 100} color={T.pri} height={4} />
                      <Txt numberOfLines={1} adjustsFontSizeToFit s={11} c={T.t3} center style={{ marginTop: 3 }}>
                        {Math.min(done, goal)} de {goal}
                      </Txt>
                    </View>
                  ) : null}
                </Card>
              </Touchable>
            );
          })}
        </View>
      </Section>
    </ScreenScroll>
  );
}
