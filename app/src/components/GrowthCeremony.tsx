import React, { useEffect, useRef } from 'react';
import { Animated, Vibration, View } from 'react-native';

import { STAGE_LABEL, type PetStage } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';
import { PetFace } from './PetFace';
import { Card, PrimaryButton, Txt } from './ui';

const LINES: Record<PetStage, string> = {
  filhote: '',
  jovem: 'Uma semana de cuidado. O Mellow cresceu com você.',
  adulto: 'Trinta dias de cuidado. Ele já é adulto — e foi você que fez isso.',
};

/**
 * Aparece uma vez quando o pet muda de estágio. O momento merece pausa: é a
 * recompensa por consistência, a única coisa que faz o pet crescer.
 */
export function GrowthCeremony({ stage, onDone }: { stage: PetStage; onDone: () => void }) {
  const { state } = useApp();
  const { T } = useTheme();
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Vibration.vibrate([0, 60, 80, 120]);
    Animated.spring(grow, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
  }, [grow]);

  return (
    <View
      style={{ marginHorizontal: 16, marginTop: 10 }}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${state.petName} agora é ${STAGE_LABEL[stage]}`}
    >
      <Card radius={24} padding={20} style={{ alignItems: 'center' }}>
        <Txt s={10.5} w={800} c={T.pri} ls={1.6}>
          EVOLUÇÃO
        </Txt>
        <Animated.View
          style={{
            marginVertical: 8,
            transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            opacity: grow,
          }}
        >
          <PetFace size={96} petType={state.petType} emotion="happy" stage={stage} />
        </Animated.View>
        <Txt s={18} w={800} c={T.t1}>
          {state.petName} agora é {STAGE_LABEL[stage].toLowerCase()}!
        </Txt>
        <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 6, textAlign: 'center' }}>
          {LINES[stage]}
        </Txt>
        <PrimaryButton label="Que orgulho" onPress={onDone} style={{ marginTop: 14, alignSelf: 'stretch' }} />
      </Card>
    </View>
  );
}

