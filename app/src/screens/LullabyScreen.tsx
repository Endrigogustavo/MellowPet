import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, PrimaryButton, ScreenTitle, Txt } from '../components/ui';
import { stageForDays } from '../pet/growth';
import { LULLABY_START, lullabyStep, type LullabyState } from '../pet/lullaby';
import { useApp, useTheme } from '../state/AppContext';

/**
 * Ninar o Mellow — biofeedback em forma de jogo.
 *
 * O pet só pega no sono se o seu rosto ficar solto: testa lisa, mandíbula
 * destravada. É treino de relaxamento disfarçado — a barra mostra na hora o
 * efeito de soltar (ou travar) o rosto.
 */
export function LullabyScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
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
    actions.habit('lullaby');
    actions.markCare();
  }, [game.asleep, actions]);

  // Balanço do berço: mais lento conforme o pet vai dormindo.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    if (!game.asleep) loop.start();
    return () => loop.stop();
  }, [sway, game.asleep]);

  const hint = game.asleep
    ? `${state.petName} dormiu. Esse rosto solto que você fez agora — dá pra voltar a ele quando quiser.`
    : game.relaxed === null
      ? 'Olhe para a câmera com o rosto bem iluminado.'
      : game.relaxed
        ? 'Isso… ombros para baixo, testa lisa. Ele está ficando sonolento.'
        : 'Ele percebeu tensão. Solte a mandíbula e a testa, devagar.';

  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });

  return (
    <ScreenScroll>
      <ScreenTitle label="BIOFEEDBACK" title={`Ninar o\n${state.petName}`} />

      <Section top={4}>
        <Card radius={28} padding={22} style={{ alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <PetFace
              size={150}
              petType={state.petType}
              emotion={game.asleep || game.progress > 0.7 ? 'happy' : 'neutral'}
              stage={stageForDays(state.careDays)}
              accessory={state.habits.equipped}
            />
          </Animated.View>
          <Txt s={22} w={800} c={T.t3} style={{ marginTop: 4, height: 30 }}>
            {game.asleep ? 'z z z' : game.progress > 0.5 ? 'z' : ''}
          </Txt>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Bar pct={game.progress * 100} color={game.relaxed === false ? T.t3 : T.pri} height={10} />
          </View>
          <Txt s={13} lh={1.5} c={T.t2} center style={{ marginTop: 14 }} accessibilityLiveRegion="polite">
            {hint}
          </Txt>
        </Card>
      </Section>

      <Section>
        {game.asleep ? (
          <PrimaryButton label="Voltar para a Home" onPress={() => actions.go('home')} />
        ) : (
          <Txt s={11.5} lh={1.5} c={T.t3} center>
            Leva cerca de um minuto de rosto relaxado. Tudo é lido no aparelho; nada é gravado.
          </Txt>
        )}
      </Section>
    </ScreenScroll>
  );
}
