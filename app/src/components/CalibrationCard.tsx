import React from 'react';
import { View } from 'react-native';

import { EMOTIONS } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { describeGains } from '../vision/personalCalibration';
import { Card, Touchable, Txt } from './ui';

/**
 * O que o motor aprendeu com você. Mostrar isso importa: uma personalização
 * invisível vira "o app mudou sozinho"; visível, vira algo que a pessoa
 * entende e pode desfazer.
 */
export function CalibrationCard() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const g = state.personalGains;
  const changes = describeGains(g);

  return (
    <Card radius={24} padding={18}>
      <Txt s={12} w={800} c={T.t2}>
        Calibração pessoal
      </Txt>
      <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
        {g.samples === 0
          ? 'Responda "essa leitura combinou?" na tela inicial e faça check-ins. O Mellow ajusta a leitura ao seu rosto, só neste aparelho.'
          : `Aprendido com ${g.samples} ${g.samples === 1 ? 'resposta' : 'respostas'}. Fica só neste aparelho.`}
      </Txt>
      {changes.length > 0 ? (
        <View style={{ gap: 4, marginTop: 10 }}>
          {changes.map(({ emotion, gain }) => (
            <Txt key={emotion} s={12} c={T.t2}>
              {EMOTIONS[emotion].label}:{' '}
              <Txt s={12} w={800} c={T.t1}>
                {gain < 1 ? 'mais exigente' : 'mais sensível'} ({Math.round((gain - 1) * 100)}%)
              </Txt>
            </Txt>
          ))}
        </View>
      ) : null}
      <Touchable
        onPress={() => actions.go('fairness')}
        accessibilityLabel="Abrir auditoria da leitura"
        style={{ marginTop: 12 }}
      >
        <Txt s={12.5} w={800} c={T.pri}>
          A leitura é justa com você? Ver o acerto
        </Txt>
      </Touchable>
      {g.samples > 0 ? (
        <Touchable onPress={actions.resetCalibration} accessibilityLabel="Zerar calibração pessoal" style={{ marginTop: 12 }}>
          <Txt s={12.5} w={800} c={T.pri}>
            Zerar e voltar ao padrão
          </Txt>
        </Touchable>
      ) : null}
    </Card>
  );
}
