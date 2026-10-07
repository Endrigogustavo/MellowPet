import { NativeModule, registerWebModule } from 'expo';

import { MellowVisionModuleEvents } from './MellowVision.types';

// MellowVisionModule is not available on the web platform.
class MellowVisionModule extends NativeModule<MellowVisionModuleEvents> {
  async getCapabilitiesAsync() {
    return {
      available: false,
      cameraPreview: false,
      faceLandmarker: false,
      localOnly: true,
      modelVersion: 'unavailable',
      pipelineVersion: 'mellow-vision-v3.1.0-native',
    };
  }

  setBackgroundVision(_enabled: boolean, _intervalMinutes: number) {}

  getBackgroundVision() {
    return { enabled: false, intervalMinutes: 15 };
  }
}

export const isMellowVisionAvailable = false;
export default registerWebModule(MellowVisionModule, 'MellowVision');
