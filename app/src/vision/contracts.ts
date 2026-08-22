import type { EmotionKey } from '../data/emotions';
import { isMellowVisionAvailable } from '../../modules/mellow-vision';

export type SignalStatus =
  | 'ready'
  | 'no_face'
  | 'insufficient_quality'
  | 'uncertain'
  | 'warming_up'
  | 'permission_denied'
  | 'camera_unavailable';

export type VisionMode = 'demo' | 'disabled' | 'device';

export type VisionSnapshot = {
  observedExpression: EmotionKey;
  signalConfidence: number;
  signalStatus: SignalStatus;
  qualityScore: number;
  qualityReasons: string[];
  tensionSignal: number | null;
  capturedAtMs: number;
  modelVersion: string;
  pipelineVersion: string;
  calibrationProgress: number | null;
  /** Até 2 emoções secundárias mais fortes da leitura (além da primária) —
   * juntas formam a mistura de até 3 emoções exibida na UI. Expressões
   * reais raramente são puras. Ordenadas por confiança, descendente. */
  secondaryEmotions: { expression: EmotionKey; confidence: number }[];
};

const configuredMode = process.env.EXPO_PUBLIC_VISION_MODE;

/**
 * Sem override explícito, o modo é decidido pelo binário em execução, não
 * por __DEV__: o mesmo .env.local roda tanto no Expo Go (sem o módulo
 * nativo — cai pra demo) quanto no development build (módulo presente —
 * detecção real), sem precisar trocar configuração por alvo.
 *
 * Simulação é uma ferramenta de desenvolvimento explícita. Em build de
 * produção sem módulo nativo, o app abstém (`unknown`) em vez de apresentar
 * dados fictícios como detecção real.
 */
export const VISION_MODE: VisionMode =
  configuredMode === 'demo' || configuredMode === 'device' || configuredMode === 'disabled'
    ? configuredMode
    : isMellowVisionAvailable
      ? 'device'
      : __DEV__
        ? 'demo'
        : 'disabled';
