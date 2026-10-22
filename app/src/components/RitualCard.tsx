import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { morningDream } from '../pet/dreamClient';
import { ritualDays } from '../pet/habits';
import { pendingRitual } from '../pet/rituals';
import { useApp, useTheme } from '../state/AppContext';
import { Card, Chip, PrimaryButton, Touchable, Txt } from './ui';

const SLEEP = ['péssimo', 'mal', 'ok', 'bem', 'ótimo'];

/**
 * Bom dia (5h–12h): o pet conta o sonho e pergunta do sono.
 * Boa noite (20h–5h): um momento de fechar o dia, e o pet vai dormir.
 * Some depois de feito ou dispensado, até a próxima janela.
 */
export function RitualCard() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const ritual = pendingRitual(new Date(), ritualDays(state.habits));
  const [dream, setDream] = useState<string | null>(null);

  const userId = state.userId;
  const petName = state.petName;
  const habits = state.habits;
  useEffect(() => {
    if (ritual !== 'morning' || !userId || dream) return;
    morningDream(userId, petName, habits)
      .then(setDream)
      .catch(() => undefined);
  }, [ritual, userId, petName, habits, dream]);

  if (!ritual) return null;

  const finish = () => {
    actions.habit(ritual);
    actions.markCare();
  };

  return (
    <Card radius={22} padding={16}>
      <Txt s={14.5} w={800} c={T.t1}>
        {ritual === 'morning' ? `Bom dia! ${state.petName} sonhou esta noite` : `Boa noite. Hora de ${state.petName} dormir`}
      </Txt>

      {ritual === 'morning' ? (
        <>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6, fontStyle: 'italic' }}>
            {dream ?? '…'}
          </Txt>
          <Txt s={12} w={700} c={T.t1} style={{ marginTop: 12, marginBottom: 8 }}>
            E você, como dormiu?
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SLEEP.map((label) => (
              <Chip key={label} label={label} on={false} onPress={finish} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
            Antes de dormir, pense numa coisa boa de hoje — pequena vale. {state.petName} se aconchega e apaga a luz.
          </Txt>
          <PrimaryButton
            label={`Boa noite, ${state.petName}`}
            onPress={() => {
              finish();
              actions.set({ petMood: 'neutral', breathing: true, breathTick: 0 });
            }}
            style={{ marginTop: 12 }}
          />
        </>
      )}

      <Touchable
        onPress={() => actions.dismissRitual(ritual)}
        accessibilityLabel="Dispensar ritual"
        style={{ marginTop: 10, alignSelf: 'center' }}
      >
        <Txt s={12} w={800} c={T.t3}>
          Agora não
        </Txt>
      </Touchable>
    </Card>
  );
}
