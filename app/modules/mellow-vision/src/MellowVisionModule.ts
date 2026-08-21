import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  MellowVisionCapabilities,
  MellowVisionModuleEvents,
} from './MellowVision.types';

export declare class MellowVisionModule extends NativeModule<MellowVisionModuleEvents> {
  getCapabilitiesAsync(): Promise<MellowVisionCapabilities>;
}

const nativeModule = requireOptionalNativeModule<MellowVisionModule>('MellowVision');

export const isMellowVisionAvailable = nativeModule !== null;
export default nativeModule;
