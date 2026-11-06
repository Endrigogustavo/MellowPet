import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { PetKey } from '../data/pets';
import { BRAND, hexA, mix } from '../theme/palette';

export type FoodId = 'strawberry' | 'fish' | 'honey' | 'apple' | 'cookie' | 'berries';

export type FoodSpec = {
  id: FoodId;
  label: string;
  crumb: string;
  crumbAlt: string;
};

/** Seis comidinhas que se alternam em sequência a cada toque em "Alimentar". */
export const FOODS: readonly FoodSpec[] = [
  { id: 'strawberry', label: 'morango fresco', crumb: '#E86A78', crumbAlt: '#68B078' },
  { id: 'fish', label: 'peixinho crocante', crumb: '#F0A26B', crumbAlt: '#FBD4B4' },
  { id: 'honey', label: 'favo de mel', crumb: '#F2B84B', crumbAlt: '#FFE394' },
  { id: 'apple', label: 'maçã doce', crumb: '#DF6468', crumbAlt: '#FCE5C8' },
  { id: 'cookie', label: 'biscoito amanteigado', crumb: '#E2AF78', crumbAlt: '#5C4963' },
  { id: 'berries', label: 'mirtilos silvestres', crumb: '#7A80C7', crumbAlt: '#68B078' },
] as const;

export const PLAY_TRICKS = [
  'spin360',
  'headerBall',
  'sixSeven',
  'bubbleBoop',
  'starJuggle',
] as const;

export type PlayTrick = (typeof PLAY_TRICKS)[number];

/** Ilustração vetorial suave da comida da vez, seguindo a geometria orgânica do pet. */
export function FoodIllustration({ id, size = 42 }: { id: FoodId; size?: number }) {
  switch (id) {
    case 'strawberry':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* Corpo do morango */}
          <Path
            d="M 24 42 C 13 38 9 27 11 19 C 12.5 13.5 18 12 24 13.5 C 30 12 35.5 13.5 37 19 C 39 27 35 38 24 42 Z"
            fill="#E86A78"
            stroke="#C95261"
            strokeWidth={1.2}
          />
          {/* Brilho lateral */}
          <Path d="M 15.5 26 C 15 21 17 17.5 19.2 18 C 19.6 22.5 18 26 15.5 26 Z" fill="#FFF5F6" opacity={0.38} />
          {/* Sementinhas claras */}
          <Circle cx={19} cy={23} r={1.25} fill="#FFF2D6" />
          <Circle cx={28} cy={22.5} r={1.25} fill="#FFF2D6" />
          <Circle cx={23.8} cy={28} r={1.25} fill="#FFF2D6" />
          <Circle cx={18.5} cy={32} r={1.15} fill="#FFF2D6" />
          <Circle cx={29} cy={31.5} r={1.15} fill="#FFF2D6" />
          <Circle cx={24} cy={35.5} r={1.15} fill="#FFF2D6" />
          {/* Coroa de folhinhas */}
          <Path
            d="M 24 14 C 20 9 13 10 13 14 C 17 15.5 21 15.5 24 14 Z M 24 14 C 28 9 35 10 35 14 C 31 15.5 27 15.5 24 14 Z M 24 14 C 21.5 8 26.5 8 24 14 Z"
            fill="#68B078"
            stroke="#4E915D"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <Path d="M 24 12 L 24 7.5" stroke="#4E915D" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );

    case 'fish':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* Rabinho */}
          <Path
            d="M 35 24 L 44 16.5 C 45 20.5 45 27.5 44 31.5 Z"
            fill="#E79058"
            stroke="#C77440"
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
          {/* Nadadeira superior */}
          <Path d="M 21 15.5 Q 25 10.5 29.5 15.5 Z" fill="#E79058" />
          {/* Corpo do peixinho */}
          <Path
            d="M 7 24 C 10 15 24 13.5 36 21.5 C 37.5 22.8 37.5 25.2 36 26.5 C 24 34.5 10 33 7 24 Z"
            fill="#F4AA74"
            stroke="#C77440"
            strokeWidth={1.2}
          />
          {/* Barriguinha clara */}
          <Path d="M 11 26.5 Q 22 31.5 32.5 26.2 Q 22 28.5 11 26.5 Z" fill="#FDE0C6" opacity={0.8} />
          {/* Guelra suave e olho */}
          <Path d="M 17.5 19.8 Q 19.5 24 17.5 28.2" fill="none" stroke="#C77440" strokeWidth={1.5} strokeLinecap="round" />
          <Circle cx={13} cy={22.8} r={2} fill={BRAND.plum} />
          <Circle cx={13.6} cy={22.1} r={0.7} fill="#FFFFFF" />
        </Svg>
      );

    case 'honey':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* Pote / favo arredondado */}
          <Path
            d="M 13 19 C 11 25 12 36 24 38 C 36 36 37 25 35 19 Z"
            fill="#EAA43A"
            stroke="#C38222"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Cobertura de mel escorrendo */}
          <Path
            d="M 12 18 C 12 13 17 11 24 11 C 31 11 36 13 36 18 C 36 21 33.5 22 31.5 20.5 C 29.5 19 28.5 24.5 25.5 24.5 C 22.5 24.5 22 19.5 19.5 21 C 17.5 22.5 12 21.5 12 18 Z"
            fill="#FFD978"
            stroke="#C38222"
            strokeWidth={1.15}
          />
          {/* Detalhe de brilho e tampa */}
          <Path d="M 16.5 31.5 C 15.8 27.5 17 24 19.2 24.5 C 19.8 28 18.8 31.5 16.5 31.5 Z" fill="#FFF6DA" opacity={0.45} />
          <Ellipse cx={24} cy={10.5} rx={6.5} ry={2.4} fill="#D58D28" />
        </Svg>
      );

    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* Cabinho e folha */}
          <Path d="M 24 15.5 Q 24.5 10 27.5 8.5" fill="none" stroke="#5C4963" strokeWidth={2.2} strokeLinecap="round" />
          <Path
            d="M 25 12.5 C 28.5 8.5 34.5 9.5 34 13.5 C 31 15.5 27.5 15 25 12.5 Z"
            fill="#68B078"
            stroke="#4E915D"
            strokeWidth={1}
          />
          {/* Corpo da maçã */}
          <Path
            d="M 24 16.5 C 19.5 13.5 11.5 15.5 11 24.5 C 10.5 33.5 17 39.5 22 39 C 23.2 38.8 24.8 38.8 26 39 C 31 39.5 37.5 33.5 37 24.5 C 36.5 15.5 28.5 13.5 24 16.5 Z"
            fill="#DF6468"
            stroke="#BC4B50"
            strokeWidth={1.2}
          />
          <Path d="M 15 27.5 C 14.5 22.5 16.5 19 18.6 19.5 C 19 24 17.5 27.5 15 27.5 Z" fill="#FFF4F4" opacity={0.4} />
        </Svg>
      );

    case 'cookie':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Circle cx={24} cy={25} r={14.5} fill="#E4B17A" stroke="#BC8852" strokeWidth={1.3} />
          <Path
            d="M 14 19 A 11.5 11.5 0 0 1 31 15.5"
            fill="none"
            stroke="#F6D7B2"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.65}
          />
          {/* Gotinhas de cacau/ameixa */}
          <Circle cx={19} cy={21} r={2.2} fill={BRAND.plum} />
          <Circle cx={28.5} cy={20.5} r={1.9} fill={BRAND.plum} />
          <Circle cx={24.5} cy={27.2} r={2.3} fill={BRAND.plum} />
          <Circle cx={17.8} cy={29.5} r={1.8} fill={BRAND.plum} />
          <Circle cx={30} cy={29.5} r={2} fill={BRAND.plum} />
        </Svg>
      );

    case 'berries':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* Folhinhas de base */}
          <Path
            d="M 24 20 C 17 13 10 15 12 21 C 16 23 20 22 24 20 Z M 24 20 C 31 13 38 15 36 21 C 32 23 28 22 24 20 Z"
            fill="#68B078"
            stroke="#4E915D"
            strokeWidth={1}
          />
          {/* Dois mirtilos polpudos */}
          <Circle cx={18.5} cy={28} r={8.5} fill="#757BC2" stroke="#585EA3" strokeWidth={1.2} />
          <Circle cx={16} cy={25.2} r={2} fill="#FFFFFF" opacity={0.32} />
          <Circle cx={29.5} cy={29.5} r={8} fill="#8D93DA" stroke="#686EB5" strokeWidth={1.2} />
          <Circle cx={27.2} cy={26.8} r={1.8} fill="#FFFFFF" opacity={0.34} />
          <Path d="M 17 32.5 L 18.5 31 L 20 32.5" fill="none" stroke="#484E8C" strokeWidth={1.3} strokeLinecap="round" />
          <Path d="M 28 33.8 L 29.5 32.3 L 31 33.8" fill="none" stroke="#53599B" strokeWidth={1.3} strokeLinecap="round" />
        </Svg>
      );
  }
}

/**
 * Patinha / nadadeira / asinha adaptada à espécie ativa do usuário.
 * Usa exatamente a cor do corpo do animal na tela para parecer parte orgânica dele.
 */
export function PetPaw({
  petType,
  body,
  line,
  side,
  size = 40,
}: {
  petType: PetKey;
  body: string;
  line: string;
  side: 'left' | 'right';
  size?: number;
}) {
  const pawFill =
    petType === 'panda' || petType === 'penguin'
      ? BRAND.plum
      : body;
  const strokeColor = mix(pawFill, line, 0.28);
  const padFill = mix(pawFill, BRAND.rose, 0.62);
  const mirror = side === 'right';

  // Nadadeira / asinha suave para foca, pinguim e coruja
  if (petType === 'seal' || petType === 'penguin' || petType === 'owl') {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}
      >
        <Path
          d="M 10 28 C 7 19 14 10 25 11 C 34 12 37 21 33 29 C 29 36 14 36 10 28 Z"
          fill={pawFill}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
        <Path
          d="M 17 17 Q 22 14 27 17"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.35}
        />
      </Svg>
    );
  }

  // Patinha fofinha com almofadinha e três dedinhos para urso, gatinho, cachorro, coelho, etc.
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M 9 24 C 9 14.5 15 10 22 10 C 29 10 35 14.5 35 24 C 35 32 29.5 36 22 36 C 14.5 36 9 32 9 24 Z"
        fill={pawFill}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      {/* Três almofadinhas superiores */}
      <Circle cx={15.5} cy={17.5} r={2.6} fill={padFill} />
      <Circle cx={22} cy={15.5} r={2.8} fill={padFill} />
      <Circle cx={28.5} cy={17.5} r={2.6} fill={padFill} />
      {/* Almofada central */}
      <Ellipse cx={22} cy={25.5} rx={5.6} ry={4.4} fill={padFill} />
    </Svg>
  );
}

/** Bolinha lúdica perfeitamente redonda em tons suaves da marca para cabecear. */
export function PlayBallSvg({ size = 38, accent }: { size?: number; accent: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Circle cx={22} cy={22} r={18.5} fill="#FAF6F2" stroke={hexA(BRAND.plum, 0.24)} strokeWidth={1.4} />
      {/* Gomos curvos ancorados exatamente sobre o círculo r=18.5 */}
      <Path d="M 5.84 13 Q 22 20 38.16 13 A 18.5 18.5 0 0 0 5.84 13 Z" fill={accent} opacity={0.88} />
      <Path d="M 5.84 31 Q 22 24 38.16 31 A 18.5 18.5 0 0 1 5.84 31 Z" fill={BRAND.peach} opacity={0.92} />
      <Path d="M 3.5 22 Q 22 19.5 40.5 22" fill="none" stroke={hexA(BRAND.plum, 0.16)} strokeWidth={1.3} />
      <Circle cx={22} cy={22} r={4} fill="#FAF6F2" stroke={hexA(BRAND.plum, 0.22)} strokeWidth={1.2} />
      {/* Brilho superior */}
      <Path d="M 11.5 15.5 A 12.5 12.5 0 0 1 19.5 9.8" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
    </Svg>
  );
}

/** Bolha de sabão translúcida para a brincadeira de estourar com o focinho. */
export function BubbleSvg({ size = 30, tint }: { size?: number; tint: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle
        cx={18}
        cy={18}
        r={14.5}
        fill={hexA(tint, 0.24)}
        stroke={hexA(tint, 0.72)}
        strokeWidth={1.5}
      />
      <Path
        d="M 10.5 14 A 8.5 8.5 0 0 1 17 8.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Circle cx={23.5} cy={23.5} r={1.6} fill="#FFFFFF" opacity={0.6} />
    </Svg>
  );
}

/** Estrelinha de 4 pontas arredondada para malabares e giros. */
export function SparkleStarSvg({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M 12 2 C 13.2 8.2 15.8 10.8 22 12 C 15.8 13.2 13.2 15.8 12 22 C 10.8 15.8 8.2 13.2 2 12 C 8.2 10.8 10.8 8.2 12 2 Z"
        fill={color}
      />
    </Svg>
  );
}

