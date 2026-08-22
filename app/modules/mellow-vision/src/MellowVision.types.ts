import type { StyleProp, ViewStyle } from 'react-native';

export type NativeVisionStatus =
  | 'ready'
  | 'no_face'
  | 'insufficient_quality'
  | 'warming_up'
  | 'camera_unavailable';

/**
 * Dados agregados enviados pelo código nativo. Pixels, bitmaps e landmarks
 * completos nunca atravessam a ponte React Native.
 */
export type VisionFramePayload = {
  status: NativeVisionStatus;
  qualityScore: number;
  qualityReasons: string[];
  blendshapes: Record<string, number>;
  faceCoverage: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  yaw: number;
  pitch: number;
  roll: number;
  latencyMs: number;
  capturedAtMs: number;
  droppedFrames: number;
  receivedFrames: number;
  processedFrames: number;
  effectiveFps: number;
  thermalState: string;
  initializationLatencyMs: number;
  modelVersion: string;
  pipelineVersion: string;
};

export type VisionErrorPayload = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type MellowVisionCapabilities = {
  available: boolean;
  cameraPreview: boolean;
  faceLandmarker: boolean;
  localOnly: boolean;
  modelVersion: string;
  pipelineVersion: string;
};

export type MellowVisionModuleEvents = Record<string, never>;

export type MellowVisionViewProps = {
  active?: boolean;
  maxFps?: number;
  mirror?: boolean;
  /** Só inclui a superfície de preview no capture request quando true. Fora
   * da tela de câmera a view fica invisível e fora da área desenhada — sem
   * isso, a superfície de preview não seria drenada e travaria a sessão
   * inteira (afetando também os frames de análise). Default true. */
  showPreview?: boolean;
  onVisionResult?: (event: { nativeEvent: VisionFramePayload }) => void;
  onVisionError?: (event: { nativeEvent: VisionErrorPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
