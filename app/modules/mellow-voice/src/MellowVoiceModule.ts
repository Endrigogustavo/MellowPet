import { NativeModule, requireOptionalNativeModule } from 'expo';

export declare class MellowVoiceModule extends NativeModule {
  isAvailable(): boolean;
  /** Abre o ditado do sistema. null = a pessoa cancelou. */
  listen(prompt: string): Promise<string | null>;
}

// Opcional: iOS e Expo Go não têm o módulo; o botão de ditado some.
const MellowVoice = requireOptionalNativeModule<MellowVoiceModule>('MellowVoice');

export function isVoiceAvailable(): boolean {
  try {
    return MellowVoice?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export default MellowVoice;
