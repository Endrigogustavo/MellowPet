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
      pipelineVersion: 'mellow-vision-v2',
    };
  }
}

export const isMellowVisionAvailable = false;
export default registerWebModule(MellowVisionModule, 'MellowVision');
