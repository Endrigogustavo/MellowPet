import { NativeModule, requireOptionalNativeModule } from 'expo';

export declare class MellowWidgetModule extends NativeModule<Record<string, never>> {
  updateMood(
    emotion: string,
    label: string,
    level: number,
    progress: number,
    moodPct: number,
    petName: string,
    hunger: string
  ): void;
  updateNowPlaying(
    track: string | null,
    artist: string | null,
    isPaused: boolean,
    source: string,
    progress: number
  ): void;
  /** Três listas paralelas em vez de objetos: a ponte do Expo converte
   * arrays de primitivos direto, sem precisar de um record convertível. */
  updateRoutine(times: string[], names: string[], states: string[]): void;
  updateStreak(days: number, week: boolean[]): void;
}

const nativeModule = requireOptionalNativeModule<MellowWidgetModule>('MellowWidget');

export const isMellowWidgetAvailable = nativeModule !== null;
export default nativeModule;
