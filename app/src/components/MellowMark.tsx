import React from 'react';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { Colors } from '../theme';

/**
 * Mellow — a marca da MellowPet, na variante monocromatica.
 *
 * Esta e a versao usada *dentro* do app (cabecalhos, estados vazios, sobre).
 * O icone do launcher e a variante de fundo escuro, em app/assets/icon.png.
 *
 * Monocromatica quer dizer uma cor so no corpo: `color` pinta a silhueta e
 * `detail` vaza as feicoes. O padrao funciona sobre o fundo claro do app; em
 * cima de uma superficie colorida, passe as duas cores.
 */

export interface MellowMarkProps {
  /** Lado do quadrado, em px. */
  size?: number;
  /** Cor da silhueta. */
  color?: string;
  /** Cor das feicoes vazadas — deve contrastar com `color`. */
  detail?: string;
  /** Bigodes ficam melhores a partir de ~32px; abaixo disso viram ruido. */
  showWhiskers?: boolean;
}

const WHISKERS = [
  'M 34 65 L 15 60',
  'M 34 68 L 13 68',
  'M 34 71 L 16 76',
  'M 66 65 L 85 60',
  'M 66 68 L 87 68',
  'M 66 71 L 84 76',
];

export const MellowMark: React.FC<MellowMarkProps> = ({
  size = 32,
  color = Colors.textPrimary,
  detail = Colors.surface,
  showWhiskers,
}) => {
  const whiskers = showWhiskers ?? size >= 32;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Corpo e nadadeiras */}
      <G fill={color}>
        <Ellipse cx={38} cy={93} rx={11} ry={7} rotation={-15} originX={38} originY={93} />
        <Ellipse cx={62} cy={93} rx={11} ry={7} rotation={15} originX={62} originY={93} />
        <Ellipse cx={14} cy={76} rx={12} ry={7} rotation={-20} originX={14} originY={76} />
        <Ellipse cx={86} cy={76} rx={12} ry={7} rotation={20} originX={86} originY={76} />
        <Path d="M 50 9 C 75 9 89 29 89 53 C 89 78 72 91 50 91 C 28 91 11 78 11 53 C 11 29 25 9 50 9 Z" />
      </G>

      {/* Barriga */}
      <Ellipse cx={50} cy={68} rx={18} ry={12.5} fill={detail} opacity={0.16} />

      {whiskers && (
        <G fill="none" stroke={detail} strokeWidth={1.8} strokeLinecap="round" opacity={0.85}>
          {WHISKERS.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
      )}

      {/* Olhos fechados — o traco "mellow" */}
      <G fill="none" stroke={detail} strokeWidth={4.2} strokeLinecap="round">
        <Path d="M 30 51 q 7 -9 14 0" />
        <Path d="M 56 51 q 7 -9 14 0" />
      </G>

      {/* Nariz e boca */}
      <Path d="M 44.5 58 Q 50 55.5 55.5 58 Q 55 64.5 50 67 Q 45 64.5 44.5 58 Z" fill={detail} />
      <G fill="none" stroke={detail} strokeWidth={2.6} strokeLinecap="round">
        <Path d="M 50 67 Q 50 72 44 72" />
        <Path d="M 50 67 Q 50 72 56 72" />
      </G>
    </Svg>
  );
};
