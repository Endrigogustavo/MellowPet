import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  /** Um ou mais `d` de path, no viewBox 24×24 do design. */
  d?: string | string[];
  size?: number;
  color?: string;
  /** Espessura do traço (`stroke-width`). */
  sw?: number;
  /** Desenha o círculo r=9 que vários ícones do design trazem à parte. */
  circle?: boolean;
  /** Preenche em vez de contornar. */
  filled?: boolean;
};

export function Icon({ d, size = 20, color = '#000', sw = 1.8, circle, filled }: Props) {
  const paths = d ? (Array.isArray(d) ? d : [d]) : [];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {circle ? (
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={sw} fill="none" />
      ) : null}
      {paths
        .filter(Boolean)
        .map((p, i) => (
          <Path
            key={i}
            d={p}
            fill={filled ? color : 'none'}
            stroke={filled ? undefined : color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
    </Svg>
  );
}
