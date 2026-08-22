import { NativeModule, requireOptionalNativeModule } from 'expo';

export declare class MellowWidgetModule extends NativeModule<Record<string, never>> {
  /** Grava o humor atual em SharedPreferences e atualiza o widget de tela
   * inicial (Android only — sem módulo nativo em iOS/Expo Go, vira no-op). */
  updateMoodAsync(label: string, colorHex: string): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<MellowWidgetModule>('MellowWidget');

export const isMellowWidgetAvailable = nativeModule !== null;
export default nativeModule;
