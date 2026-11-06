import React from 'react';
import { View } from 'react-native';

import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, ScreenTitle, Touchable, Txt, useColumnWidth } from '../components/ui';
import { stageForDays } from '../pet/growth';
import { ACCESSORIES, TRAIT_LABEL, personality } from '../pet/habits';
import { useApp, useTheme } from '../state/AppContext';
import { hapticTap } from '../theme/haptics';

/**
 * Guarda-roupa: acessórios ganhos por constância, nunca comprados. Cada um
 * mostra o hábito que o libera e quanto falta, um mapa de autocuidado
 * em forma de cuidado com o pet.
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
      <ScreenTitle label="Guarda-roupa" title="O jeito do seu Mellow" />

      <Section top={4}>
        <Card radius={24} padding={20} style={{ alignItems: 'center' }}>
          <PetFace
            size={120}
            petType={state.petType}
            emotion="happy"
            stage={stage}
            accessory={h.equipped}
          />
          <Txt s={13.5} w={800} c={T.t1} center style={{ marginTop: 10 }}>
            {traits
              ? `${state.petName} é ${traits.map((t) => TRAIT_LABEL[t]).join(' e ')}`
              : `${state.petName} ainda está descobrindo o próprio jeito`}
          </Txt>
          <Txt s={12} lh={1.5} c={T.t3} center style={{ marginTop: 4 }}>
            A personalidade nasce do jeito como vocês passam o tempo juntos.
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
                onPress={() => {
                  hapticTap();
                  actions.equip(on ? null : a.id);
                }}
                accessibilityLabel={unlocked ? `${on ? 'Tirar' : 'Vestir'} ${a.label}` : `${a.label}, bloqueado`}
                accessibilityState={{ selected: on, disabled: !unlocked }}
                style={{ width: cell }}
              >
                <Card
                  radius={20}
                  padding={14}
                  style={{
                    alignItems: 'center',
                    borderColor: on ? T.pri : T.bd,
                    borderWidth: on ? 2 : 1,
                    backgroundColor: on ? T.priL : T.surf,
                  }}
                >
                  <View style={{ opacity: unlocked ? 1 : 0.4 }}>
                    <PetFace
                      size={64}
                      petType={state.petType}
                      emotion="neutral"
                      stage={stage}
                      accessory={a.id}
                    />
                  </View>
                  <Txt s={13} w={800} c={on ? T.pri : T.t1} center style={{ marginTop: 6 }}>
                    {a.label}
                  </Txt>
                  <Txt s={11} lh={1.4} c={T.t3} center style={{ marginTop: 2 }}>
                    {unlocked ? (on ? 'Vestindo agora' : 'Toque para vestir') : a.how}
                  </Txt>
                  {!unlocked ? (
                    <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
                      <Bar pct={(Math.min(done, goal) / goal) * 100} color={T.pri} height={5} />
                      <Txt s={10.5} c={T.t3} center style={{ marginTop: 4 }}>
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
