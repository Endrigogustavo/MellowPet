import { NativeModule, requireOptionalNativeModule } from 'expo';

type Events = {
  onEncounter: (event: { payload: string }) => void;
  onStatus: (event: { status: string }) => void;
};

export declare class MellowNearbyModule extends NativeModule<Events> {
  start(payloadJson: string): boolean;
  stop(): boolean;
}

// Opcional: iOS e Expo Go não têm o módulo, e o app segue sem encontros.
const MellowNearby = requireOptionalNativeModule<MellowNearbyModule>('MellowNearby');

export function isMellowNearbyAvailable(): boolean {
  return MellowNearby != null;
}

export default MellowNearby;
