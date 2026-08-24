import { NativeModule, requireOptionalNativeModule } from 'expo';

export declare class MellowWidgetModule extends NativeModule<Record<string, never>> {
  updateMood(emoji: string, label: string, level: number, progress: number): void;
  updateNowPlaying(track: string | null, artist: string | null, isPaused: boolean): void;
  updateRoutine(time: string | null, name: string | null): void;
}

const nativeModule = requireOptionalNativeModule<MellowWidgetModule>('MellowWidget');

export const isMellowWidgetAvailable = nativeModule !== null;
export default nativeModule;
