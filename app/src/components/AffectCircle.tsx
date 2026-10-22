import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../state/AppContext';
import { AFFECT_TEXT, type Affect } from '../vision/affect';
import { Txt } from './ui';

/**
 * Círculo de Russell: valência (esquerda desagradável → direita agradável) ×
 * ativação (embaixo calmo → em cima agitado). O ponto é o humor estimado
 * agora; o rótulo derivado capta o que os sete rótulos não captam.
 */
export function AffectCircle({ affect, size = 168 }: { affect: Affect; size?: number }) {
  const { T, emoColor } = useTheme();
  const r = size / 2 - 14;
  const c = size / 2;
  const x = c + affect.valence * r;
  const y = c - affect.arousal * r;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={T.bd} strokeWidth={1.5} fill="none" />
        <Line x1={c - r} y1={c} x2={c + r} y2={c} stroke={T.bd} strokeWidth={1} />
        <Line x1={c} y1={c - r} x2={c} y2={c + r} stroke={T.bd} strokeWidth={1} />
        <SvgText x={c} y={10} fontSize={9} fill={T.t3} textAnchor="middle">
          agitado
        </SvgText>
        <SvgText x={c} y={size - 2} fontSize={9} fill={T.t3} textAnchor="middle">
          calmo
        </SvgText>
        <SvgText x={4} y={c - 4} fontSize={9} fill={T.t3}>
          desagradável
        </SvgText>
        <SvgText x={size - 4} y={c - 4} fontSize={9} fill={T.t3} textAnchor="end">
          agradável
        </SvgText>
        <Circle cx={x} cy={y} r={14} fill={emoColor} opacity={0.18} />
        <Circle cx={x} cy={y} r={6} fill={emoColor} />
      </Svg>
      <Txt s={13} w={800} c={T.t1} style={{ marginTop: 4 }}>
        {AFFECT_TEXT[affect.label]}
      </Txt>
      <Txt s={10.5} c={T.t3} style={{ marginTop: 2 }}>
        estimado pelo rosto, não pelo que você sente
      </Txt>
    </View>
  );
}
