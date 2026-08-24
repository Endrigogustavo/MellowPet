import { NativeModule, requireOptionalNativeModule } from 'expo';

export declare class MellowWidgetsModule extends NativeModule {
  updateMood(emoji: string, label: string, sub: string): void;
  updateNowPlaying(track: string | null, artist: string | null, isPaused: boolean): void;
  updateRoutine(time: string | null, name: string | null): void;
}

const nativeModule = requireOptionalNativeModule<MellowWidgetsModule>('MellowWidgets');

export const isMellowWidgetsAvailable = nativeModule !== null;
export default nativeModule;
