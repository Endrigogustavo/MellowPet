import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  PanResponder,
  useWindowDimensions,
} from 'react-native';

/**
 * Gesto do mini-player.
 *
 *  - arrastar para CIMA (ou tocar) abre o player em tela cheia;
 *  - arrastar para BAIXO dispensa o card — a música continua tocando.
 *
 * Soltar antes do limite devolve o card ao lugar com uma mola.
 *
 * Dois detalhes fazem isto funcionar, e ambos custaram um bug:
 *
 * 1. O PanResponder é criado UMA vez e nunca mais. O `NowPlayingBar` que nos
 *    hospeda re-renderiza várias vezes por segundo (a posição do áudio anda
 *    sozinha), e recriar o responder troca os `panHandlers` no meio do gesto:
 *    o toque em andamento perde os handlers, o RN encerra o gesto, a mola
 *    devolve o card ao lugar e o move seguinte o joga de volta para o dedo.
 *    Num arrasto lento isso acontecia várias vezes por segundo e o card
 *    tremia subindo e descendo. Por isso tudo que muda mora em refs.
 *
 * 2. A captura acontece na fase de *capture*. O conteúdo é um `Touchable`, e
 *    num arrasto lento ele assumia o toque primeiro — o dedo se movia e o
 *    card ficava parado.
 */

/** Movimento vertical que confirma "isto é um arrasto, não um toque". */
const DRAG_SLOP = 5;
/** Distância que confirma a intenção em cada direção. */
const EXPAND_DISTANCE = 56;
const DISMISS_DISTANCE = 72;
/** Ou um movimento rápido, mesmo curto. */
const FLICK_VELOCITY = 0.7;
/** Ao subir o card acompanha o dedo pela metade: sinaliza que é um empurrão
 * para abrir, não um arrasto livre. */
const UP_RESISTANCE = 0.45;

type Props = {
  children: React.ReactNode;
  /** Altura de repouso, medida a partir do rodapé. */
  restBottom: number;
  /** Arrastou para cima o bastante. */
  onExpand: () => void;
  /** Arrastou para baixo o bastante. */
  onDismiss: () => void;
  /** Altura real do card, para as telas reservarem espaço embaixo. */
  onLayout?: (e: LayoutChangeEvent) => void;
};

export function DraggableDock({ children, restBottom, onExpand, onDismiss, onLayout }: Props) {
  const { height } = useWindowDimensions();

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Tudo que o responder precisa ler mora aqui, para ele nunca precisar ser
  // recriado. Ver o comentário (1) no topo.
  const latest = useRef({ onExpand, onDismiss, height, restBottom });
  latest.current = { onExpand, onDismiss, height, restBottom };

  /** Deslocamento já acumulado quando o gesto foi reivindicado — o dedo já
   * andou o `DRAG_SLOP` antes disso, e sem descontar o card daria um salto. */
  const grantDy = useRef(0);

  const responder = useRef(
    PanResponder.create({
      // Nunca captura no toque inicial: os botões precisam recebê-lo.
      onStartShouldSetPanResponderCapture: () => false,
      // Mas captura o movimento antes do filho — ver o comentário (2).
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dy) > DRAG_SLOP && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      // Depois de pego, não devolve: sem isto a rolagem da tela toma o gesto
      // no meio e o card fica pendurado fora do lugar.
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (_e, g) => {
        grantDy.current = g.dy;
      },

      onPanResponderMove: (_e, g) => {
        const dy = g.dy - grantDy.current;
        translateY.setValue(dy < 0 ? dy * UP_RESISTANCE : dy);
        // Descendo, o card vai sumindo — o gesto mostra o resultado antes de
        // terminar, em vez de só desaparecer de uma vez no fim.
        opacity.setValue(dy > 0 ? Math.max(0.35, 1 - dy / (DISMISS_DISTANCE * 2.2)) : 1);
      },

      onPanResponderRelease: (_e, g) => {
        const dy = g.dy - grantDy.current;
        const settle = latest.current;
        const up = dy < -EXPAND_DISTANCE || g.vy < -FLICK_VELOCITY;
        const down = dy > DISMISS_DISTANCE || g.vy > FLICK_VELOCITY;

        if (up) {
          // Volta ao lugar antes de abrir: ao fechar a tela cheia, o card
          // precisa estar onde sempre esteve.
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }),
            Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: false }),
          ]).start();
          settle.onExpand();
          return;
        }

        if (down) {
          // Sai pela borda de baixo, não uma distância fixa — em telas
          // maiores um valor fixo deixava o card visível durante o fade.
          const exit = settle.height - settle.restBottom + 60;
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: exit,
              duration: 240,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]).start(({ finished }) => {
            if (!finished) return;
            // Reposiciona escondido, para reaparecer no lugar certo.
            translateY.setValue(0);
            opacity.setValue(1);
            settle.onDismiss();
          });
          return;
        }

        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 8 }),
          Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: false }),
        ]).start();
      },

      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: false }),
        ]).start();
      },
    })
  ).current;

  // Se o card for desmontado no meio de uma animação, os valores ficam onde
  // pararam e ele reapareceria torto na próxima faixa.
  useEffect(
    () => () => {
      translateY.setValue(0);
      opacity.setValue(1);
    },
    [translateY, opacity]
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={onLayout}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: restBottom,
        opacity,
        transform: [
          { translateY },
          // Encolhe de leve ao descer: reforça que está indo embora.
          {
            scale: translateY.interpolate({
              inputRange: [0, DISMISS_DISTANCE * 2],
              outputRange: [1, 0.94],
              extrapolate: 'clamp',
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
