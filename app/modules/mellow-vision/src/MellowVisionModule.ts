import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  MellowVisionCapabilities,
  MellowVisionModuleEvents,
} from './MellowVision.types';

export type BackgroundVisionState = {
  enabled: boolean;
  intervalMinutes: number;
};

export declare class MellowVisionModule extends NativeModule<MellowVisionModuleEvents> {
  getCapabilitiesAsync(): Promise<MellowVisionCapabilities>;
  /** Leitura facial com o app fechado. Liga um serviço em primeiro plano
   * com notificação permanente — é a única forma de usar a câmera fora da
   * tela desde o Android 9. */
  setBackgroundVision(enabled: boolean, intervalMinutes: number): void;
  getBackgroundVision(): BackgroundVisionState;
}

const nativeModule = requireOptionalNativeModule<MellowVisionModule>('MellowVision');

export const isMellowVisionAvailable = nativeModule !== null;
export default nativeModule;
