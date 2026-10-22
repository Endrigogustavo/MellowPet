import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { BROWS, EYES, MOUTH, type EmotionKey } from '../data/emotions';
import { DET, EARS, HEAD, PATCH_FILL, PET_BODY, type PetKey } from '../data/pets';
import { mix } from '../theme/palette';
import { STAGE_SHAPE, type PetStage } from '../pet/growth';
import type { AccessoryId } from '../pet/habits';

/**
 * O viewBox original do design é 100×100 com `overflow:visible`, porque a orelha
 * do coelho e o chifre do unicórnio saem por cima. No react-native-svg não há
 * overflow visível, então o viewBox ganha folga e o tamanho compensa a diferença.
 */
const VIEW_BOX = '-4 -10 108 108';
const SCALE = 1.08;

const LINE = '#2E2A33';
const WHISKERS = [
  'M 30 64 L 8 59',
  'M 29 68.5 L 6 68',
  'M 30 73 L 9 78',
  'M 70 64 L 92 59',
  'M 71 68.5 L 94 68',
  'M 70 73 L 91 78',
];

export type PetFaceProps = {
  /** Tamanho na escala do design (viewBox 100). */
  size: number;
  petType: PetKey;
  /** Ausente no modo miniatura: usa rosto neutro e sorriso fixo. */
  emotion?: EmotionKey;
  /** Corpo já ajustado ao tema. Se omitido, usa a cor base do bichinho. */
  body?: string;
  /** Cores do corpo vindas do tema. */
  belly?: string;
  whisker?: string;
  blush?: number;
  /** Estágio de crescimento: muda proporções (filhote tem olhos maiores). */
  stage?: PetStage;
  /** Acessório conquistado por hábito (cachecol, fones…). */
  accessory?: AccessoryId | null;
};

export function PetFace({
  size,
  petType,
  emotion,
  body: bodyProp,
  belly: bellyProp,
  whisker = 'rgba(107,100,112,0.75)',
  blush = 0.55,
  stage = 'jovem',
  accessory = null,
}: PetFaceProps) {
  const shape = STAGE_SHAPE[stage];
  const body = bodyProp ?? PET_BODY[petType];
  const det = DET[petType];
  const preview = !emotion;

  const earFill =
    petType === 'panda' || petType === 'penguin'
      ? '#4A3550'
      : petType === 'unicorn'
        ? '#F7E3B0'
        : body;
  const innerFill = petType === 'unicorn' ? '#EBCF8E' : mix(body, '#F6C9CF', 0.55);
  const muzzleFill = mix(body, '#FFFFFF', 0.88);
  const patchFill = PATCH_FILL[petType] ?? '#FFFFFF';
  const beakFill = petType === 'owl' ? '#E9A878' : '#EDBE7C';
  const belly = bellyProp ?? mix(body, '#000000', 0.09);

  // Olhos e sobrancelhas seguem a emoção; o "feliz" troca os círculos por arcos.
  const eyes = emotion ? EYES[emotion] : null;
  const brows = emotion ? BROWS[emotion] : ['', ''];
  const arcEyes = emotion === 'happy';
  const eyeY = emotion === 'surprised' ? 51 : 52;
  const eyeR = (emotion === 'surprised' ? 7.6 : emotion === 'fearful' ? 5.4 : 6.6) * shape.eye;
  const glintY = emotion === 'surprised' ? 48.4 : 49.6;
  const mouth = emotion ? MOUTH[emotion] : 'M 40 70 q 10 8 20 0';

  const px = size * SCALE * shape.scale;

  return (
    <Svg width={px} height={px} viewBox={VIEW_BOX}>
      {/* orelhas */}
      <G fill={earFill}>
        {EARS[petType][0] ? <Path d={EARS[petType][0]} /> : null}
        {EARS[petType][1] ? <Path d={EARS[petType][1]} /> : null}
      </G>
      <G fill={innerFill}>
        {det.i[0] ? <Path d={det.i[0]} /> : null}
        {det.i[1] ? <Path d={det.i[1]} /> : null}
      </G>

      {/* cabeça */}
      <Path d={HEAD} fill={body} />
      {/* filhote: um cachinho no topo da cabeça */}
      {stage === 'filhote' ? (
        <Path
          d="M 50 9 c -4 -6 3 -10 6 -5 c 2 4 -3 6 -4 3"
          fill="none"
          stroke={LINE}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ) : null}

      {!preview && det.bel > 0 ? (
        <Ellipse cx={50} cy={72} rx={30} ry={19} fill={belly} opacity={det.bel} />
      ) : null}
      {!preview ? (
        <Ellipse
          cx={38}
          cy={26}
          rx={8}
          ry={5}
          fill="#FFFFFF"
          opacity={0.2}
          rotation={-22}
          origin="38, 26"
        />
      ) : null}

      {/* manchas e focinho */}
      <G fill={patchFill}>
        {det.p[0] ? <Path d={det.p[0]} /> : null}
        {det.p[1] ? <Path d={det.p[1]} /> : null}
      </G>
      {det.m ? <Path d={det.m} fill={muzzleFill} /> : null}

      {!preview ? (
        <>
          <Circle cx={20} cy={60} r={7 * shape.blush} fill="#F0A0AC" opacity={blush} />
          <Circle cx={80} cy={60} r={7 * shape.blush} fill="#F0A0AC" opacity={blush} />
          {det.w ? (
            <G fill="none" stroke={whisker} strokeWidth={1.5} strokeLinecap="round">
              {WHISKERS.map((d) => (
                <Path key={d} d={d} />
              ))}
            </G>
          ) : null}
        </>
      ) : null}

      {/* olhos */}
      {arcEyes && eyes ? (
        <G fill="none" stroke={LINE} strokeWidth={4.4} strokeLinecap="round">
          <Path d={eyes[0]} />
          <Path d={eyes[1]} />
        </G>
      ) : (
        <G>
          <Circle cx={36} cy={eyeY} r={eyeR} fill={LINE} />
          <Circle cx={64} cy={eyeY} r={eyeR} fill={LINE} />
          <Circle cx={38.3} cy={glintY} r={2.3} fill="#FFFFFF" />
          <Circle cx={66.3} cy={glintY} r={2.3} fill="#FFFFFF" />
        </G>
      )}

      {brows[0] ? (
        <G fill="none" stroke={LINE} strokeWidth={2.6} strokeLinecap="round">
          <Path d={brows[0]} />
          <Path d={brows[1]} />
        </G>
      ) : null}

      {/* bico / nariz / boca */}
      {det.b ? <Path d={det.b} fill={beakFill} /> : null}
      {!det.b ? <Ellipse cx={50} cy={64} rx={4.6} ry={3.8} fill={LINE} /> : null}
      <Path d={mouth} fill="none" stroke={LINE} strokeWidth={2.6} strokeLinecap="round" />

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

/** Desenhados por cima do rosto, no mesmo viewBox da cabeça (círculo r 42). */
function Accessory({ id }: { id: AccessoryId }) {
  switch (id) {
    case 'cachecol':
      return (
        <G>
          <Path d="M 22 82 Q 50 96 78 82 L 80 89 Q 50 103 20 89 Z" fill="#E25C5C" />
          <Path d="M 63 90 l 4 8 l 7 -3 l -3 -7 Z" fill="#C94848" />
          <Path d="M 30 88 l 2 -5 M 40 91 l 2 -5 M 50 92 l 2 -5 M 60 91 l 2 -5 M 70 88 l 2 -5" stroke="#F7B2B2" strokeWidth={1.6} />
        </G>
      );
    case 'fones':
      return (
        <G>
          <Path d="M 12 52 A 38 38 0 0 1 88 52" fill="none" stroke="#3B3550" strokeWidth={5} strokeLinecap="round" />
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
          <Path d="M 11 36 Q 50 16 89 36" fill="none" stroke="#5CC8B0" strokeWidth={6} strokeLinecap="round" />
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
}: {
  size: number;
  color: string;
  faceColor?: string;
  smile?: boolean;
}) {
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
