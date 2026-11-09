import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, PrimaryButton, ScreenTitle, Txt, useReducedMotion } from '../components/ui';
import { stageForDays } from '../pet/growth';
import { LULLABY_START, lullabyStep, type LullabyState } from '../pet/lullaby';
import { useApp, useTheme } from '../state/AppContext';
import { hapticSuccess } from '../theme/haptics';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Ninar o Mellow: biofeedback suave em forma de descanso compartilhado.
 *
 * O pet pega no sono conforme o rosto fica solto: testa lisa, mandíbula
 * destravada. A barra acompanha na hora o ritmo de relaxamento.
 */
export function LullabyScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const reduced = useReducedMotion();
  const [game, setGame] = useState<LullabyState>(LULLABY_START);
  const face = useRef({ ready: false, tension: null as number | null, expression: 'neutral' });
  face.current = {
    ready: state.signalStatus === 'ready',
    tension: state.tension,
    expression: state.observedExpression,
  };
  const rewarded = useRef(false);
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      setGame((g) => lullabyStep(g, face.current, now - last));
      last = now;
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!game.asleep || rewarded.current) return;
    rewarded.current = true;
    hapticSuccess();
    actions.habit('lullaby');
    actions.markCare();
  }, [game.asleep, actions]);

  // Balanço suave do berço, respeitando movimento reduzido.
  useEffect(() => {
    if (reduced || game.asleep) {
      sway.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sway, game.asleep, reduced]);

  const hint = game.asleep
    ? `${state.petName} dormiu. Esse rosto solto que você fez agora fica disponível sempre que quiser voltar a ele.`
    : game.relaxed === null
      ? state.signalStatus === 'permission_denied'
        ? 'A câmera está sem permissão. Libere a câmera nas configurações do celular para ninar o pet.'
        : state.signalStatus === 'camera_unavailable'
          ? 'A câmera não está disponível agora. Feche outros apps que usam a câmera e tente de novo.'
          : 'Olhe para a câmera com o rosto bem iluminado.'
      : game.relaxed
        ? 'Isso… ombros para baixo, testa lisa. Ele está ficando sonolento.'
        : 'Ele percebeu tensão. Solte a mandíbula e a testa, devagar.';

  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] });

  return (
    <ScreenScroll>
      <ScreenTitle label="Descanso guiado" title="Hora de ninar" />

      <Section top={4}>
        <Card radius={28} padding={24} style={{ alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <PetFace
              size={150}
              petType={state.petType}
              emotion={game.asleep || game.progress > 0.7 ? 'happy' : 'neutral'}
              stage={stageForDays(state.careDays)}
              accessory={state.habits.equipped}
            />
          </Animated.View>
          <Txt s={20} w={800} c={T.t3} style={{ marginTop: 6, height: 28 }}>
            {game.asleep ? 'z z z' : game.progress > 0.5 ? 'z' : ''}
          </Txt>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Bar pct={game.progress * 100} color={game.relaxed === false ? T.t3 : T.pri} height={10} />
          </View>
          <Txt s={13.5} lh={1.55} c={T.t2} center style={{ marginTop: 14 }} accessibilityLiveRegion="polite">
            {hint}
          </Txt>
        </Card>
      </Section>

      <Section>
        {game.asleep ? (
          <PrimaryButton label="Voltar para o início" onPress={() => actions.goTab('home')} />
        ) : (
          <Txt s={12} lh={1.5} c={T.t3} center>
            Leva cerca de um minuto de rosto relaxado. Tudo é lido no aparelho; nada é gravado.
          </Txt>
        )}
      </Section>
    </ScreenScroll>
  );
}
