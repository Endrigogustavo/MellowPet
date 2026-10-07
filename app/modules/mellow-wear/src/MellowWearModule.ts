import { NativeModule, requireOptionalNativeModule } from 'expo';

/** Check-in feito no relógio, ainda não gravado no Supabase. */
export type WatchCheckin = {
  emotion: string;
  /** ms epoch do momento em que a pessoa tocou, não do recebimento. */
  at: number;
  source: 'watch';
  /** Batimentos no instante do check-in, quando o sensor deu leitura. */
  heartRate?: number;
  tags?: string[];
};

export declare class MellowWearModule extends NativeModule<Record<string, never>> {
  /** JSON com os check-ins recebidos do relógio. Esvazia a fila nativa. */
  drainWatchCheckins(): string;
  pushState(emotion: string, level: number, streak: number, checkedInToday: boolean): boolean;
  connectedWatches(): Promise<number>;
}

// Opcional: em iOS e no Expo Go o módulo nativo não existe, e o app precisa
// seguir funcionando sem relógio.
const MellowWear = requireOptionalNativeModule<MellowWearModule>('MellowWear');

export function isMellowWearAvailable(): boolean {
  return MellowWear != null;
}

export default MellowWear;
