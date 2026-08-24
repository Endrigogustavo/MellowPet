import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { MellowSpotifyModuleEvents } from './MellowSpotify.types';

export declare class MellowSpotifyModule extends NativeModule<MellowSpotifyModuleEvents> {
  isSpotifyInstalled(): boolean;
  isConnected(): boolean;
  connect(clientId: string, redirectUri: string): Promise<boolean>;
  disconnect(): Promise<void>;
  play(uri: string): Promise<void>;
  queue(uri: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  skipNext(): Promise<void>;
  skipPrevious(): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<MellowSpotifyModule>('MellowSpotify');

export const isMellowSpotifyAvailable = nativeModule !== null;
export default nativeModule;
