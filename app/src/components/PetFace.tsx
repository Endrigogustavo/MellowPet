import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { BROWS, EYES, MOUTH, type EmotionKey } from '../data/emotions';
import { HEAD, PET_BODY, PET_SPECS, type PetKey } from '../data/pets';
import { STAGE_SHAPE, type PetStage } from '../pet/growth';
import type { AccessoryId } from '../pet/habits';
import { BRAND, LIGHT, mix } from '../theme/palette';

const VIEW_BOX = '-6 -12 112 112';
const SCALE = 1.08;

export type PetMouthMode = 'bite' | 'chewA' | 'chewB' | 'playGrin' | 'boop' | 'refuse';

export type PetFaceProps = {
  /** Tamanho na escala do design (viewBox 100). */
  size: number;
  petType: PetKey;
  /** Emoção identificada pelo sistema; se omitida na vitrine, usa estado neutro calmo. */
  emotion?: EmotionKey;
  /** Cor base do rosto já ajustada ao tema (opcional). */
  body?: string;
  belly?: string;
  line?: string;
  whisker?: string;
  blush?: number;
  /** Estágio de crescimento: muda proporções. */
  stage?: PetStage;
  /** Acessório conquistado por hábito (cachecol, fones…). */
  accessory?: AccessoryId | null;
  /** Expressão transitória durante animações de mastigar ou brincar. */
  mouthMode?: PetMouthMode | null;
  /** Mantido por compatibilidade. */
  variant?: 'full' | 'avatar';
};

/** Brilho orgânico na testa — assinatura gráfica do MellowPet (`DESIGN.md`). */
function ForeheadShine({ x = 29, y = 27 }: { x?: number; y?: number }) {
  return (
    <Path
      d={`M ${x} ${y} C ${x - 1.5} ${y - 4} ${x + 4} ${y - 8.5} ${x + 12.5} ${y - 7} C ${x + 14} ${y - 3} ${x + 8.5} ${y + 1.5} ${x} ${y} Z`}
      fill={LIGHT.surf}
      opacity={0.28}
    />
  );
}

/** Sombra ambiente inferior para dar volume cerâmico/tátil à cabeça. */
function ChinShadow({ fill }: { fill: string }) {
  return (
    <Path
      d="M 21 71 C 30 83 70 83 79 71 C 71 85.5 29 85.5 21 71 Z"
      fill={fill}
      opacity={0.48}
    />
  );
}

/** Bochechas rosadas (`BRAND.rose`) que acompanham o ritmo de mastigação. */
function RosyCheeks({
  leftX = 20.5,
  rightX = 79.5,
  cy = 58.5,
  leftR,
  rightR,
  opacity,
}: {
  leftX?: number;
  rightX?: number;
  cy?: number;
  leftR: number;
  rightR: number;
  opacity: number;
}) {
  return (
    <G>
      <Ellipse cx={leftX} cy={cy} rx={leftR} ry={leftR * 0.72} fill={BRAND.rose} opacity={opacity} />
      <Ellipse cx={rightX} cy={cy} rx={rightR} ry={rightR * 0.72} fill={BRAND.rose} opacity={opacity} />
    </G>
  );
}

/** Nariz esculpido com brilho superior suave. */
function SculptedNose({
  cy = 59.5,
  rx = 4.4,
  ry = 3.1,
  fill = BRAND.plum,
}: {
  cy?: number;
  rx?: number;
  ry?: number;
  fill?: string;
}) {
  return (
    <G>
      <Ellipse cx={50} cy={cy} rx={rx} ry={ry} fill={fill} />
      <Ellipse cx={48.6} cy={cy - 0.9} rx={rx * 0.34} ry={ry * 0.28} fill="#FFFFFF" opacity={0.42} />
    </G>
  );
}

/**
 * Base anatômica polida dos 12 bichinhos, seguindo o estilo vetorial tátil do MellowPet
 * (`PetActionProps.tsx` e `DESIGN.md`):
 * - Contorno externo suave e tonal (`mix(body, BRAND.plum, 0.32)`, `strokeWidth={1.6}`)
 * - Sombreamento ambiente inferior + brilho orgânico na testa (`ForeheadShine`)
 * - Planos faciais limpos sem sobreposição entre olhos (`cy=50`), nariz (`cy=59.5`) e boca (`y=66.5..73.5`)
 */
function HeadBase({
  petType,
  body,
  ink,
  whiskerColor,
  cheekOpacity,
  leftCheekR,
  rightCheekR,
}: {
  petType: PetKey;
  body: string;
  ink: string;
  whiskerColor: string;
  cheekOpacity: number;
  leftCheekR: number;
  rightCheekR: number;
}) {
  const spec = PET_SPECS[petType] ?? PET_SPECS.seal;
  const shade = mix(body, BRAND.plum, 0.14);
  const border = mix(body, ink, 0.34);
  const belly = spec.colors.belly;
  const accent = spec.colors.accent;

  switch (petType) {
    // 1. FOCA — silhueta hidrodinâmica clássica do Mellow com barriga pêssego suave e focinho esculpido
    case 'seal':
      return (
        <G>
          <Path
            d="M 50 13 C 73 13 87 29 88 53 C 89 75 74 87 50 87 C 26 87 11 75 12 53 C 13 29 27 13 50 13 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <Ellipse cx={50} cy={72} rx={27} ry={13.5} fill={LIGHT.sealBelly} opacity={0.45} />
          <ForeheadShine x={28} y={27} />
          {/* Manchinhas suaves de foca na testa */}
          <Ellipse cx={25} cy={32} rx={3.6} ry={2} fill={shade} opacity={0.65} transform="rotate(-22 25 32)" />
          <Ellipse cx={75} cy={32} rx={3.6} ry={2} fill={shade} opacity={0.65} transform="rotate(22 75 32)" />
          {/* Sombra e almofada do focinho em peça única */}
          <Ellipse cx={50} cy={67.5} rx={18.5} ry={12} fill={shade} opacity={0.35} />
          <Path
            d="M 50 55.5 C 58 54.5 68 57.5 68 66 C 68 74 59 78 50 78 C 41 78 32 74 32 66 C 32 57.5 42 54.5 50 55.5 Z"
            fill={belly}
          />
          <RosyCheeks leftX={20.5} rightX={79.5} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          {/* Bigodes elegantes ancorados nas laterais */}
          <G fill="none" stroke={whiskerColor} strokeWidth={1.5} strokeLinecap="round">
            <Path d="M 30 62 L 10 58" />
            <Path d="M 29 66.5 L 8 66.5" />
            <Path d="M 30 71 L 11 75" />
            <Path d="M 70 62 L 90 58" />
            <Path d="M 71 66.5 L 92 66.5" />
            <Path d="M 70 71 L 89 75" />
          </G>
          <SculptedNose cy={59.5} rx={4.5} ry={3.1} fill={ink} />
        </G>
      );

    // 2. CACHORRO — orelhas caídas em cacau-caramelo, faixa clara (blaze) e focinho acolhedor
    case 'dog':
      return (
        <G>
          {/* Orelhas caídas esculpidas com camada interna */}
          <Path
            d="M 23 22 C 8 21 3 40 8 59 C 11 68 21 65 23 51 Z"
            fill={accent}
            stroke={mix(accent, ink, 0.38)}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <Path d="M 21 28 C 12 28 8 42 12 55 C 14 61 19 59 21 49 Z" fill={mix(accent, ink, 0.18)} />
          <Path
            d="M 77 22 C 92 21 97 40 92 59 C 89 68 79 65 77 51 Z"
            fill={accent}
            stroke={mix(accent, ink, 0.38)}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <Path d="M 79 28 C 88 28 92 42 88 55 C 86 61 81 59 79 49 Z" fill={mix(accent, ink, 0.18)} />
          {/* Cabeça arredondada e acolhedora */}
          <Path
            d="M 50 14 C 73 14 85 29 85 52 C 85 74 71 87 50 87 C 29 87 15 74 15 52 C 15 29 27 14 50 14 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          <ForeheadShine x={28} y={27} />
          {/* Mancha suave no olho direito + pintinhas creme na testa */}
          <Ellipse cx={65} cy={49.5} rx={10.8} ry={9.8} fill={shade} opacity={0.65} transform="rotate(-8 65 49.5)" />
          <Ellipse cx={35} cy={38.5} rx={3.3} ry={1.9} fill={belly} opacity={0.9} />
          <Ellipse cx={65} cy={38.5} rx={3.3} ry={1.9} fill={belly} opacity={0.9} />
          {/* Almofada do focinho com sombra suave */}
          <Ellipse cx={50} cy={67.8} rx={17.5} ry={12} fill={shade} opacity={0.35} />
          <Ellipse cx={50} cy={66.5} rx={17.5} ry={12} fill={belly} />
          <RosyCheeks leftX={21.5} rightX={78.5} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59.2} rx={4.8} ry={3.3} fill={ink} />
        </G>
      );

    // 3. GATINHO — orelhas triangulares altas, bochechas felinas macias e listras sutis na testa
    case 'cat':
      return (
        <G>
          <Path
            d="M 24 25 L 13 6 Q 27 8 39 17 C 45 15.5 55 15.5 61 17 Q 73 8 87 6 L 76 25 C 85 34 89 48 88 60 C 87 75 73 87 50 87 C 27 87 13 75 12 60 C 11 48 15 34 24 25 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          {/* Orelha interna acolchoada */}
          <Path d="M 25 24 L 18 11 Q 27 13 35 19.5 Z" fill={belly} opacity={0.85} />
          <Path d="M 75 24 L 82 11 Q 73 13 65 19.5 Z" fill={belly} opacity={0.85} />
          {/* Três listrinhas suaves de gatinho na testa */}
          <Path
            d="M 50 17.5 L 50 24.5 M 44 18.5 L 45 24 M 56 18.5 L 55 24"
            stroke={shade}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <ForeheadShine x={27} y={29} />
          {/* Focinho macio */}
          <Ellipse cx={50} cy={67.5} rx={16} ry={11.5} fill={shade} opacity={0.3} />
          <Ellipse cx={50} cy={66.5} rx={16} ry={11.5} fill={belly} />
          <RosyCheeks leftX={20.5} rightX={79.5} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          {/* Bigodes finos e curvos */}
          <G fill="none" stroke={whiskerColor} strokeWidth={1.45} strokeLinecap="round">
            <Path d="M 28 62.5 Q 18 60 9 59" />
            <Path d="M 28 67 Q 18 66.5 9 67.5" />
            <Path d="M 72 62.5 Q 82 60 91 59" />
            <Path d="M 72 67 Q 82 66.5 91 67.5" />
          </G>
          {/* Narizinho triangular arredondado */}
          <Path
            d="M 45.8 57.5 Q 50 56.5 54.2 57.5 Q 52.8 62 50 62 Q 47.2 62 45.8 57.5 Z"
            fill={ink}
          />
          <Ellipse cx={48.6} cy={58.4} rx={1.4} ry={0.7} fill="#FFFFFF" opacity={0.42} />
        </G>
      );

    // 4. COELHO — orelhas longas esculturais em lilás Mellow e bochechas rechonchudas
    case 'bunny':
      return (
        <G>
          {/* Orelha esquerda suavemente curvada + orelha direita erguida */}
          <Path
            d="M 38 22 C 29 5 14 4 11 14 C 9 21 20 25 32 21 C 35 20 37 21 38 24 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <Path d="M 33 19.5 C 25 10 16 10 15 14.5 C 14 18 22 20 31 18 Z" fill={accent} opacity={0.78} />
          <Path
            d="M 56 22 C 52 4 56 -8 64 -7 C 72 -6 74 9 66 24 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <Path d="M 59.5 21 C 57 7 59 -1 63.5 0 C 67.5 1 67.5 11 63.5 21 Z" fill={accent} opacity={0.78} />
          {/* Cabeça em formato de pera/bochechas fofas */}
          <Path
            d="M 50 16 C 70 16 82 29 84 47 C 90 54 90 70 81 78 C 73 85 62 87 50 87 C 38 87 27 85 19 78 C 10 70 10 54 16 47 C 18 29 30 16 50 16 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          <ForeheadShine x={29} y={28} />
          <Ellipse cx={50} cy={67.5} rx={16} ry={11.5} fill={shade} opacity={0.32} />
          <Ellipse cx={50} cy={66.5} rx={16} ry={11.5} fill={belly} />
          <RosyCheeks leftX={20} rightX={80} cy={59} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59.2} rx={4.2} ry={2.9} fill={ink} />
        </G>
      );

    // 5. URSO — orelhas redondas acolchoadas, cabeça ampla e focinho creme bem definido
    case 'bear':
      return (
        <G>
          <Circle cx={19.5} cy={21.5} r={13} fill={body} stroke={border} strokeWidth={1.6} />
          <Circle cx={19.5} cy={21.5} r={7.2} fill={belly} opacity={0.9} />
          <Circle cx={80.5} cy={21.5} r={13} fill={body} stroke={border} strokeWidth={1.6} />
          <Circle cx={80.5} cy={21.5} r={7.2} fill={belly} opacity={0.9} />
          <Path
            d="M 50 14 C 74 14 87 29 87 53 C 87 74 73 87 50 87 C 27 87 13 74 13 53 C 13 29 26 14 50 14 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          <ForeheadShine x={28} y={27} />
          <Ellipse cx={50} cy={67.8} rx={17.5} ry={12.2} fill={shade} opacity={0.38} />
          <Ellipse cx={50} cy={66.5} rx={17.5} ry={12.2} fill={belly} />
          <RosyCheeks leftX={20.5} rightX={79.5} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59} rx={5} ry={3.4} fill={ink} />
        </G>
      );

    // 6. RAPOSA — orelhas pontudas com pontas ameixa e máscara creme contínua nas bochechas
    case 'fox': {
      const foxHead =
        'M 50 15 C 71 15 82 28 84 46 L 92 52.5 L 85 59 L 89 63.5 C 78 78 64 87 50 87 C 36 87 22 78 11 63.5 L 15 59 L 8 52.5 L 16 46 C 18 28 29 15 50 15 Z';
      return (
        <G>
          <Path d="M 22 30 L 11 3 L 41 18.5 Z" fill={body} stroke={border} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M 16 14.5 L 11 3 L 25 10.5 Z" fill={accent} />
          <Path d="M 25 28 L 18 11.5 L 35 20.5 Z" fill={belly} opacity={0.92} />
          <Path d="M 78 30 L 89 3 L 59 18.5 Z" fill={body} stroke={border} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M 84 14.5 L 89 3 L 75 10.5 Z" fill={accent} />
          <Path d="M 75 28 L 82 11.5 L 65 20.5 Z" fill={belly} opacity={0.92} />
          <Path d={foxHead} fill={body} />
          <ForeheadShine x={28} y={27} />
          {/* Pelagem creme contínua nas bochechas e metade inferior (sem traço preto dividindo o rosto) */}
          <Path
            d="M 11 63.5 L 15 59 L 8 52.5 C 22 51 38 54 50 59.5 C 62 54 78 51 92 52.5 L 85 59 L 89 63.5 C 78 78 64 87 50 87 C 36 87 22 78 11 63.5 Z"
            fill={belly}
          />
          <ChinShadow fill={shade} />
          <Path d={foxHead} fill="none" stroke={border} strokeWidth={1.6} strokeLinejoin="round" />
          <RosyCheeks leftX={21} rightX={79} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59.5} rx={4.5} ry={3.1} fill={accent} />
        </G>
      );
    }

    // 7. PANDA — orelhas ameixa-escuro, cabeça marfim-lavanda e manchas oculares equilibradas
    case 'panda':
      return (
        <G>
          <Circle cx={20.5} cy={21} r={12.5} fill={accent} stroke={ink} strokeWidth={1.4} />
          <Circle cx={79.5} cy={21} r={12.5} fill={accent} stroke={ink} strokeWidth={1.4} />
          <Path
            d="M 50 14 C 74 14 87 29 87 53 C 87 74 73 87 50 87 C 27 87 13 74 13 53 C 13 29 26 14 50 14 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={ spec.colors.shade } />
          <ForeheadShine x={28} y={27} />
          {/* Manchas oculares suaves em ameixa-escuro */}
          <Ellipse cx={35} cy={50} rx={10.2} ry={8.6} fill={accent} transform="rotate(-16 35 50)" />
          <Ellipse cx={65} cy={50} rx={10.2} ry={8.6} fill={accent} transform="rotate(16 65 50)" />
          <Ellipse cx={50} cy={67} rx={15.5} ry={11} fill={belly} />
          <RosyCheeks leftX={20.5} rightX={79.5} cy={59} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59.5} rx={4.4} ry={3} fill={accent} />
        </G>
      );

    // 8. CORUJA — penachos suaves, disco facial creme em coração e plumagem detalhada
    case 'owl':
      return (
        <G>
          <Path
            d="M 27 21 C 19 13 11 13 13 22 L 17 29 C 11 41 12 68 25 80 C 37 88 63 88 75 80 C 88 68 89 41 83 29 L 87 22 C 89 13 81 13 73 21 C 59 14.5 41 14.5 27 21 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          <ForeheadShine x={29} y={26} />
          {/* Disco facial creme acolhedor em formato de coração */}
          <Path
            d="M 50 38 C 42 30 19 32 19 50.5 C 19 65.5 32 73.5 50 73.5 C 68 73.5 81 65.5 81 50.5 C 81 32 58 30 50 38 Z"
            fill={belly}
          />
          {/* Peninhas delicadas no peito */}
          <Path
            d="M 40 77.5 Q 45 81 50 77.5 Q 55 81 60 77.5"
            fill="none"
            stroke={shade}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <RosyCheeks leftX={21.5} rightX={78.5} cy={59} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
        </G>
      );

    // 9. PINGUIM — capuz ameixa-ardósia em formato de pera e máscara creme em coração
    case 'penguin':
      return (
        <G>
          <Path
            d="M 50 13 C 74 13 86 30 87 55 C 88 75 74 87 50 87 C 26 87 12 75 13 55 C 14 30 26 13 50 13 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ForeheadShine x={28} y={26} />
          {/* Máscara facial clara em formato de coração */}
          <Path
            d="M 50 36 C 42 26 20 29 20 51 C 20 71 32 82 50 82 C 68 82 80 71 80 51 C 80 29 58 26 50 36 Z"
            fill={belly}
          />
          <ChinShadow fill={shade} />
          <RosyCheeks leftX={22.5} rightX={77.5} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
        </G>
      );

    // 10. HAMSTER — bochechas gorduchas creme-douradas sem linha preta divisória
    case 'hamster': {
      const hamsterSilhouette =
        'M 50 15 C 70 15 81 26 83 42 C 95 47 97 66 88 77 C 79 86 65 87 50 87 C 35 87 21 86 12 77 C 3 66 5 47 17 42 C 19 26 30 15 50 15 Z';
      return (
        <G>
          <Circle cx={22.5} cy={20} r={11} fill={body} stroke={border} strokeWidth={1.6} />
          <Circle cx={22.5} cy={20} r={6} fill={accent} opacity={0.85} />
          <Circle cx={77.5} cy={20} r={11} fill={body} stroke={border} strokeWidth={1.6} />
          <Circle cx={77.5} cy={20} r={6} fill={accent} opacity={0.85} />
          <Path d={hamsterSilhouette} fill={body} />
          <ForeheadShine x={28} y={27} />
          {/* Bochechas creme contínuas */}
          <Path
            d="M 17 44 C 28 45 40 51 50 57.5 C 60 51 72 45 83 44 C 94 49 96 66 88 77 C 79 86 65 87 50 87 C 35 87 21 86 12 77 C 4 66 6 49 17 44 Z"
            fill={belly}
          />
          <ChinShadow fill={shade} />
          <Path d={hamsterSilhouette} fill="none" stroke={border} strokeWidth={1.6} strokeLinejoin="round" />
          <RosyCheeks leftX={18.5} rightX={81.5} cy={59.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59.2} rx={3.8} ry={2.6} fill={ink} />
        </G>
      );
    }

    // 11. CAPIVARA — orelhas pequenas no topo e focinho arredondado bicolor acolhedor
    case 'capybara':
      return (
        <G>
          <Ellipse cx={23} cy={18.5} rx={6.5} ry={8} fill={accent} stroke={mix(accent, ink, 0.35)} strokeWidth={1.5} transform="rotate(-16 23 18.5)" />
          <Ellipse cx={23} cy={18.5} rx={3.5} ry={4.5} fill={shade} transform="rotate(-16 23 18.5)" />
          <Ellipse cx={77} cy={18.5} rx={6.5} ry={8} fill={accent} stroke={mix(accent, ink, 0.35)} strokeWidth={1.5} transform="rotate(16 77 18.5)" />
          <Ellipse cx={77} cy={18.5} rx={3.5} ry={4.5} fill={shade} transform="rotate(16 77 18.5)" />
          <Path
            d="M 50 15 C 73 15 86 28 87 53 C 88 74 75 87 50 87 C 25 87 12 74 13 53 C 14 28 27 15 50 15 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          <ForeheadShine x={28} y={27} />
          {/* Focinho largo e arredondado da capivara em tom caramelo-claro suave */}
          <Path
            d="M 33 60 C 33 55 67 55 67 60 L 68 71 C 68 77.5 60 80.5 50 80.5 C 40 80.5 32 77.5 32 71 Z"
            fill={belly}
          />
          {/* Ponte superior arredondada em cacau suave com as duas narinas */}
          <Path
            d="M 35 59.5 C 35 55.2 65 55.2 65 59.5 C 65 62.8 58 64 50 64 C 42 64 35 62.8 35 59.5 Z"
            fill={accent}
          />
          <Ellipse cx={43.5} cy={59.5} rx={2} ry={1.3} fill={ink} transform="rotate(-15 43.5 59.5)" />
          <Ellipse cx={56.5} cy={59.5} rx={2} ry={1.3} fill={ink} transform="rotate(15 56.5 59.5)" />
          <Ellipse cx={48.5} cy={57.5} rx={3} ry={0.9} fill="#FFFFFF" opacity={0.3} />
          <RosyCheeks leftX={20.5} rightX={79.5} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
        </G>
      );

    // 12. UNICÓRNIO — crina em ondas pastéis Mellow (lilás, pêssego, água) e chifre dourado-champagne
    case 'unicorn':
    default:
      return (
        <G>
          {/* Ondas da crina na lateral direita com a paleta pastel do MellowPet */}
          <Path
            d="M 75 33 C 90 37 95 50 87 62 C 80 62 76 54 74 44 Z"
            fill={BRAND.lilac}
            stroke={mix(BRAND.lilac, ink, 0.32)}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path
            d="M 77 47 C 91 52 94 65 85 75 C 78 73 75 65 74 55 Z"
            fill={BRAND.peach}
            stroke={mix(BRAND.peach, ink, 0.32)}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path
            d="M 75 59 C 87 63 88 74 80 81 C 74 79 72 72 71 65 Z"
            fill="#9ED8DB"
            stroke={mix('#9ED8DB', ink, 0.32)}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {/* Orelhas delicadas */}
          <Path d="M 24 26 L 14 8 Q 26 10 36 19 Z" fill={body} stroke={border} strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M 25 24 L 18 12.5 Q 26 14 33 19.5 Z" fill={belly} opacity={0.85} />
          <Path d="M 76 26 L 86 8 Q 74 10 64 19 Z" fill={body} stroke={border} strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M 75 24 L 82 12.5 Q 74 14 67 19.5 Z" fill={belly} opacity={0.85} />
          {/* Cabeça arredondada e suave */}
          <Path
            d="M 50 15 C 73 15 86 29 86 52 C 86 74 72 87 50 87 C 28 87 14 74 14 52 C 14 29 27 15 50 15 Z"
            fill={body}
            stroke={border}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <ChinShadow fill={shade} />
          <ForeheadShine x={27} y={28} />
          {/* Franja pastel penteada para a direita (sem cobrir o chifre) */}
          <Path
            d="M 52 15.5 C 62 13 73 17.5 75 26.5 C 65 28.5 57 24.5 52 15.5 Z"
            fill={BRAND.lilac}
            stroke={mix(BRAND.lilac, ink, 0.32)}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path
            d="M 49 19.5 C 58 18.5 67 22.5 69 29.5 C 59 31.5 53 27.5 49 19.5 Z"
            fill={BRAND.peach}
            stroke={mix(BRAND.peach, ink, 0.32)}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {/* Chifre dourado-champagne espiralado 100% visível na frente */}
          <Path
            d="M 43 21 L 48.6 -5.5 Q 50 -8 51.4 -5.5 L 57 21 Q 50 23.2 43 21 Z"
            fill={accent}
            stroke="#C9A86A"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <Path
            d="M 46.2 3 L 53.8 5.2 M 44.8 11.5 L 55.2 13.8"
            stroke="#D4B272"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Almofada clara do focinho e nariz delicado */}
          <Ellipse cx={50} cy={67.5} rx={16} ry={11.5} fill={shade} opacity={0.3} />
          <Ellipse cx={50} cy={66.5} rx={16} ry={11.5} fill={belly} />
          <RosyCheeks leftX={21} rightX={79} cy={58.5} leftR={leftCheekR} rightR={rightCheekR} opacity={cheekOpacity} />
          <SculptedNose cy={59.2} rx={4.1} ry={2.8} fill={ink} />
        </G>
      );
  }
}

/**
 * Bico anatômico polido para Coruja e Pinguim (sem boca humana abaixo),
 * refletindo dinamicamente a emoção detectada.
 */
function EmotionBeak({
  petType,
  ink,
  emotion,
  mouthMode,
}: {
  petType: 'owl' | 'penguin';
  ink: string;
  emotion?: EmotionKey;
  mouthMode?: PetMouthMode | null;
}) {
  const fill = petType === 'owl' ? '#E9A878' : '#EDBE7C';
  const border = petType === 'owl' ? '#C47D4E' : '#C9944C';
  const open =
    mouthMode === 'bite' ||
    mouthMode === 'playGrin' ||
    mouthMode === 'boop' ||
    emotion === 'surprised' ||
    emotion === 'happy';
  const isSad = emotion === 'sad' || emotion === 'angry' || emotion === 'fearful' || emotion === 'disgusted';

  if (petType === 'owl') {
    return (
      <G>
        {open ? (
          <Path
            d="M 45.8 60 Q 50 68 54.2 60 Z"
            fill="#6B364B"
            stroke={ink}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ) : null}
        <Path
          d="M 50 54.5 C 55.5 55.2 55.8 60.2 50 64.5 C 44.2 60.2 44.5 55.2 50 54.5 Z"
          fill={fill}
          stroke={border}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <Ellipse cx={48.8} cy={56.8} rx={1.4} ry={0.7} fill="#FFFFFF" opacity={0.5} />
        {isSad ? (
          <Path d="M 46.8 66.2 Q 50 64.2 53.2 66.2" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
        ) : null}
      </G>
    );
  }

  // Pinguim
  return (
    <G>
      {open ? (
        <Path
          d="M 44 60.5 Q 50 69 56 60.5 Z"
          fill="#6B364B"
          stroke={ink}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      ) : null}
      <Path
        d="M 42.5 59.5 C 42.5 54.8 57.5 54.8 57.5 59.5 C 57.5 63.5 42.5 63.5 42.5 59.5 Z"
        fill={fill}
        stroke={border}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Ellipse cx={48.5} cy={57.3} rx={1.8} ry={0.7} fill="#FFFFFF" opacity={0.5} />
      {isSad ? (
        <Path d="M 46.5 65.5 Q 50 63.5 53.5 65.5" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      ) : null}
    </G>
  );
}

export function PetFace({
  size,
  petType,
  emotion,
  body: bodyProp,
  line = BRAND.plum,
  whisker = LIGHT.sealWhisker,
  blush = 0.55,
  stage = 'jovem',
  accessory = null,
  mouthMode = null,
}: PetFaceProps) {
  const shape = STAGE_SHAPE[stage];
  const spec = PET_SPECS[petType] ?? PET_SPECS.seal;
  const body = bodyProp ?? PET_BODY[petType];
  const ink = line || spec.colors.dark;
  const hasBeak = petType === 'owl' || petType === 'penguin';

  // Somente fica em arco feliz quando a emoção reconhecida é 'happy' ou durante mastigação/brincadeira
  const happyArcEyes =
    mouthMode === 'chewA' || mouthMode === 'chewB' || mouthMode === 'playGrin' || mouthMode === 'refuse'
      ? true
      : mouthMode === 'bite' || mouthMode === 'boop'
        ? false
        : emotion === 'happy';

  const eyes = happyArcEyes ? EYES.happy : emotion ? EYES[emotion] : null;
  const brows = mouthMode ? ['', ''] : emotion ? BROWS[emotion] : ['', ''];

  // Olhos equilibrados em cy = 50, cx = 35 e 65
  const eyeY =
    mouthMode === 'boop'
      ? 48.2
      : mouthMode === 'bite'
        ? 49.4
        : emotion === 'surprised'
          ? 49.2
          : 50;

  const baseEyeR =
    mouthMode === 'bite'
      ? 6.1
      : mouthMode === 'boop'
        ? 5.9
        : emotion === 'surprised'
          ? 6.4
          : emotion === 'fearful'
            ? 5.1
            : 5.8;
  const eyeR = baseEyeR * Math.min(shape.eye, 1.06);

  const leftCheekR =
    (mouthMode === 'chewA' ? 7.8 : mouthMode === 'chewB' ? 6.4 : mouthMode ? 6.8 : 6.2) *
    Math.min(shape.blush, 1.12);
  const rightCheekR =
    (mouthMode === 'chewB' ? 7.8 : mouthMode === 'chewA' ? 6.4 : mouthMode ? 6.8 : 6.2) *
    Math.min(shape.blush, 1.12);
  const cheekOpacity = mouthMode ? Math.min(0.82, blush + 0.2) : blush;

  // Boca guiada pela emoção reconhecida (neutra e serena por padrão)
  const mouth = emotion ? MOUTH[emotion] : MOUTH.neutral;

  const px = size * SCALE * shape.scale;

  return (
    <Svg width={px} height={px} viewBox={VIEW_BOX}>
      {/* 1. Base anatômica polida com sombreamento suave e brilho na testa */}
      <HeadBase
        petType={petType}
        body={body}
        ink={ink}
        whiskerColor={whisker}
        cheekOpacity={cheekOpacity}
        leftCheekR={leftCheekR}
        rightCheekR={rightCheekR}
      />

      {/* 2. Olhos expressivos em ameixa-escuro (`BRAND.plum`) com brilho e profundidade */}
      {happyArcEyes && eyes ? (
        <G>
          {petType === 'panda' ? (
            <G fill="none" stroke={spec.colors.body} strokeWidth={5.8} strokeLinecap="round">
              <Path d={eyes[0]} />
              <Path d={eyes[1]} />
            </G>
          ) : null}
          <G fill="none" stroke={ink} strokeWidth={3.8} strokeLinecap="round">
            <Path d={eyes[0]} />
            <Path d={eyes[1]} />
          </G>
        </G>
      ) : (
        <G>
          {[35, 65].map((cx) => (
            <G key={cx}>
              {/* Anel dourado da Coruja ou aro claro sutil do Panda */}
              {petType === 'owl' ? (
                <Circle
                  cx={cx}
                  cy={eyeY}
                  r={eyeR * 1.24}
                  fill={spec.colors.accent}
                  stroke={mix(spec.colors.accent, ink, 0.35)}
                  strokeWidth={1.3}
                />
              ) : petType === 'panda' ? (
                <Circle cx={cx} cy={eyeY} r={eyeR * 1.14} fill={spec.colors.body} opacity={0.92} />
              ) : null}

              {/* Globo ocular em ameixa-escuro */}
              <Circle cx={cx} cy={eyeY} r={eyeR} fill={ink} />

              {/* Reflexo inferior aveludado na íris */}
              <Path
                d={`M ${cx - eyeR * 0.5} ${eyeY + eyeR * 0.36} Q ${cx} ${eyeY + eyeR * 0.78} ${cx + eyeR * 0.5} ${eyeY + eyeR * 0.36}`}
                fill="none"
                stroke="#9B8AA6"
                strokeWidth={eyeR * 0.22}
                strokeLinecap="round"
                opacity={0.42}
              />

              {/* Brilho especular principal + micro-ponto de luz */}
              <Circle
                cx={cx + eyeR * 0.32}
                cy={eyeY - eyeR * 0.32}
                r={eyeR * 0.35}
                fill={LIGHT.surf}
              />
              <Circle
                cx={cx - eyeR * 0.3}
                cy={eyeY + eyeR * 0.3}
                r={eyeR * 0.16}
                fill={LIGHT.surf}
                opacity={0.85}
              />
            </G>
          ))}
        </G>
      )}

      {/* Sobrancelhas dinâmicas posicionadas na testa limpa (y = 35..41) */}
      {brows[0] ? (
        <G fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round">
          <Path d={brows[0]} />
          <Path d={brows[1]} />
        </G>
      ) : null}

      {/* 3. Bico (Coruja e Pinguim) ou Boca dinâmica por emoção/ação (y = 66..74.5) */}
      {hasBeak ? (
        <EmotionBeak
          petType={petType as 'owl' | 'penguin'}
          ink={ink}
          emotion={emotion}
          mouthMode={mouthMode}
        />
      ) : mouthMode === 'bite' ? (
        <G>
          <Path
            d="M 41.5 66 Q 50 64.5 58.5 66 Q 57.5 75.5 50 76.2 Q 42.5 75.5 41.5 66 Z"
            fill="#6B364B"
            stroke={ink}
            strokeWidth={1.6}
          />
          <Path
            d="M 44.2 72.8 Q 50 69.8 55.8 72.8 Q 53.5 75.8 50 76 Q 46.5 75.8 44.2 72.8 Z"
            fill={BRAND.rose}
          />
        </G>
      ) : mouthMode === 'chewA' ? (
        <G fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 41 68.5 q 4.5 4.4 9 -0.7 q 4.5 3.8 9 -1" />
          <Path d="M 38.5 66.2 q -2 2.2 -0.3 4.4" strokeWidth={1.9} opacity={0.72} />
        </G>
      ) : mouthMode === 'chewB' ? (
        <G fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 41.5 67.2 q 4.2 4.6 8.5 1 q 4.5 5 9 0.7" />
          <Path d="M 61.5 66.2 q 2 2.2 0.3 4.4" strokeWidth={1.9} opacity={0.72} />
        </G>
      ) : mouthMode === 'playGrin' ? (
        <G>
          <Path
            d="M 41 66.5 Q 50 68.2 59 66.5 Q 57.5 75 50 75.6 Q 42.5 75 41 66.5 Z"
            fill="#6B364B"
            stroke={ink}
            strokeWidth={1.6}
          />
          <Path
            d="M 44.2 72.4 Q 50 69.6 55.8 72.4 Q 53.5 75.2 50 75.4 Q 46.5 75.2 44.2 72.4 Z"
            fill={BRAND.rose}
          />
        </G>
      ) : mouthMode === 'refuse' ? (
        <Path d="M 42 69 q 8 5 16 0" fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
      ) : mouthMode === 'boop' ? (
        <Path
          d="M 42.5 68.2 q 3.8 3.8 7.5 -1.2 q 3.8 5 7.5 1.2"
          fill="none"
          stroke={ink}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ) : (
        <Path d={mouth} fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
      )}

      {accessory ? <Accessory id={accessory} /> : null}
    </Svg>
  );
}

/** Pontos da coroa: arco de raio 40 no alto da cabeça (centro 50,50). */
const CROWN = [-140, -115, -90, -65, -40].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return [50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)] as const;
});
const PETALS = ['#F49AB6', '#FFD36E', '#A9D8FF', '#FFD36E', '#F49AB6'];

/** Acessórios desenhados sobre o rosto (viewBox 100×100). */
function Accessory({ id }: { id: AccessoryId }) {
  switch (id) {
    case 'cachecol':
      return (
        <G>
          <Path d="M 22 82 Q 50 96 78 82 L 80 89 Q 50 103 20 89 Z" fill="#E25C5C" />
          <Path d="M 63 90 l 4 8 l 7 -3 l -3 -7 Z" fill="#C94848" />
          <Path
            d="M 30 88 l 2 -5 M 40 91 l 2 -5 M 50 92 l 2 -5 M 60 91 l 2 -5 M 70 88 l 2 -5"
            stroke="#F7B2B2"
            strokeWidth={1.6}
          />
        </G>
      );
    case 'fones':
      return (
        <G>
          <Path
            d="M 12 52 A 38 38 0 0 1 88 52"
            fill="none"
            stroke="#3B3550"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <Ellipse cx={10} cy={58} rx={7} ry={11} fill="#7B6CF6" />
          <Ellipse cx={90} cy={58} rx={7} ry={11} fill="#7B6CF6" />
          <Ellipse cx={10} cy={58} rx={3} ry={6} fill="#A99FFA" />
          <Ellipse cx={90} cy={58} rx={3} ry={6} fill="#A99FFA" />
        </G>
      );
    case 'coroa':
      return (
        <G>
          <Path d="M 19 24 Q 50 0 81 24" fill="none" stroke="#6BAF6B" strokeWidth={2.4} />
          {CROWN.map(([x, y], i) => (
            <G key={i}>
              <Circle cx={x} cy={y} r={5} fill={PETALS[i]} />
              <Circle cx={x} cy={y} r={1.8} fill="#FFF4C2" />
            </G>
          ))}
        </G>
      );
    case 'faixa':
      return (
        <G>
          <Path
            d="M 11 36 Q 50 16 89 36"
            fill="none"
            stroke="#5CC8B0"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Path d="M 50 21 q 5 -7 10 -2 q -4 6 -10 2 Z" fill="#3E9C86" />
        </G>
      );
    case 'laco':
      return (
        <G>
          <Path d="M 74 16 l -11 -7 l 0 14 Z" fill="#F07AA5" />
          <Path d="M 74 16 l 11 -7 l 0 14 Z" fill="#F07AA5" />
          <Circle cx={74} cy={16} r={3} fill="#D9578A" />
        </G>
      );
    default:
      return null;
  }
}

/** Cabeça simplificada usada em avatares pequenos (chat, cabeçalhos). */
export function MellowMark({
  size,
  color,
  faceColor = '#FFFFFF',
  smile = true,
  petType,
}: {
  size: number;
  color: string;
  faceColor?: string;
  smile?: boolean;
  petType?: PetKey;
}) {
  if (petType) {
    return <PetFace size={size} petType={petType} />;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={HEAD} fill={color} />
      <G fill="none" stroke={faceColor} strokeWidth={4.2} strokeLinecap="round">
        <Path d="M 30 51 q 7 -9 14 0" />
        <Path d="M 56 51 q 7 -9 14 0" />
      </G>
      {smile ? (
        <Path
          d="M 44.5 58 Q 50 55.5 55.5 58 Q 55 64.5 50 67 Q 45 64.5 44.5 58 Z"
          fill={faceColor}
        />
      ) : null}
    </Svg>
  );
}
