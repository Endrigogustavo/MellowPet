import type { EmotionKey } from '../data/emotions';

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
};

const configuredMode = process.env.EXPO_PUBLIC_VISION_MODE;

/**
 * Simulação é uma ferramenta de desenvolvimento explícita. Em build de
 * produção sem configuração, o app abstém (`unknown`) até o pipeline nativo
 * estar disponível, em vez de apresentar dados fictícios como detecção real.
 */
export const VISION_MODE: VisionMode =
  configuredMode === 'demo' || configuredMode === 'device' || configuredMode === 'disabled'
    ? configuredMode
    : __DEV__
      ? 'demo'
      : 'disabled';
