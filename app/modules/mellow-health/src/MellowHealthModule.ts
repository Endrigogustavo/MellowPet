import { NativeModule, requireOptionalNativeModule } from 'expo';

export type HealthDay = { day: string; sleepMinutes: number | null; steps: number | null };

export declare class MellowHealthModule extends NativeModule {
  status(): 'ok' | 'needs_update' | 'unavailable';
  hasPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  readDays(days: number): Promise<HealthDay[]>;
}

// Opcional: sem o módulo (iOS, Expo Go) o cartão de saúde não aparece.
const MellowHealth = requireOptionalNativeModule<MellowHealthModule>('MellowHealth');

export default MellowHealth;
