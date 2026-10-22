import React from 'react';
import { View } from 'react-native';

import { localDay } from '../pet/growth';
import { shouldShowDivergence } from '../insights/divergence';
import { useApp, useTheme } from '../state/AppContext';
import { Card, PrimaryButton, Touchable, Txt } from './ui';

/** "Você disse que estava bem, mas o rosto ficou tenso" — com saída fácil. */
export function DivergenceCard() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const today = localDay();
  const show = shouldShowDivergence({
    lastCheckin: state.lastCheckin,
    tenseMinutes: state.tenseSinceCheckin,
    now: Date.now(),
    today,
    lastShownDay: state.divergenceShownDay,
  });
  if (!show) return null;
  const close = () => actions.set({ divergenceShownDay: today });

  return (
    <Card radius={22} padding={16}>
      <Txt s={14.5} w={800} c={T.t1}>
        Só passando para saber 💛
      </Txt>
      <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 4 }}>
        Você disse que estava bem — e pode estar mesmo. Desde então seu rosto pareceu tenso em alguns momentos. Quer
        respirar um pouco ou atualizar o check-in?
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <PrimaryButton
          label="Respirar"
          onPress={() => {
            close();
            actions.runChatAction('respirar');
          }}
          style={{ flex: 1 }}
        />
        <Touchable
          onPress={() => {
            close();
            actions.go('checkin');
          }}
          accessibilityLabel="Atualizar check-in"
        >
          <Txt s={12.5} w={800} c={T.pri}>
            Check-in
          </Txt>
        </Touchable>
        <Touchable onPress={close} accessibilityLabel="Estou bem mesmo">
          <Txt s={12.5} w={800} c={T.t3}>
            Estou bem
          </Txt>
        </Touchable>
      </View>
    </Card>
  );
}
