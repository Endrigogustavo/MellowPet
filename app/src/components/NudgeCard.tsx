import React from 'react';
import { View } from 'react-native';

import { scheduleWaterBreak } from '../notifications/notifications';
import { useApp, useTheme } from '../state/AppContext';
import { NUDGE_TEXT } from '../vision/signalTracker';
import { Card, PrimaryButton, Touchable, Txt } from './ui';

/** Lembrete do pet a partir de um sinal sustentado. Cada um leva a uma ação. */
export function NudgeCard() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const kind = state.nudge;
  if (!kind) return null;
  const text = NUDGE_TEXT[kind];
  const close = () => actions.set({ nudge: null });

  const act = () => {
    if (kind === 'tension') {
      actions.set({ nudge: null, breathing: true, breathTick: 0, focus: false });
      actions.markCare();
    } else if (kind === 'fatigue') {
      scheduleWaterBreak(0.2).catch(() => undefined);
      close();
    } else {
      close();
    }
  };

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }} accessibilityLiveRegion="polite">
      <Card radius={22} padding={16}>
        <Txt s={14.5} w={800} c={T.t1}>
          {text.title}
        </Txt>
        <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>
          {text.body}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <PrimaryButton
            label={kind === 'tension' ? 'Respirar agora' : kind === 'fatigue' ? 'Fazer a pausa' : 'Voltei'}
            onPress={act}
            style={{ flex: 1 }}
          />
          <Touchable onPress={close} accessibilityLabel="Dispensar lembrete">
            <Txt s={12.5} w={800} c={T.t3}>
              Agora não
            </Txt>
          </Touchable>
        </View>
      </Card>
    </View>
  );
}
