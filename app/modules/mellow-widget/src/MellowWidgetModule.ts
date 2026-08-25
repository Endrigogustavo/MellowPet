import { NativeModule, requireOptionalNativeModule } from 'expo';

export declare class MellowWidgetModule extends NativeModule<Record<string, never>> {
  updateMood(
    emotion: string,
    label: string,
    level: number,
    progress: number,
    moodPct: number,
    petName: string,
    hunger: string,
    pets: number
  ): void;
  /** Listas paralelas em vez de objetos: a ponte do Expo converte arrays de
   * primitivos direto, sem precisar de um record convertível. */
  updateDashboard(
    wellbeing: number,
    tlHours: string[],
    tlEmotions: string[],
    badges: boolean[],
    sleep: number[]
  ): void;
  updateInsights(
    tgNames: string[],
    tgCounts: number[],
    glNames: string[],
    glDone: number[],
    glTarget: number[]
  ): void;
  updateCare(
    names: string[],
    states: string[],
    wellbeing: number[],
    alertTitle: string | null,
    alertSub: string | null,
    checkinWhen: string | null,
    checkinTitle: string | null,
    checkinQuestion: string | null
  ): void;
  updatePlaylists(ids: string[], names: string[], emotions: string[]): void;
  updateAgenda(
    dow: string | null,
    day: string | null,
    title: string | null,
    sub: string | null
  ): void;
  updateDaily(
    water: number,
    journalTag: string,
    capsule: string | null,
    focusPercent: number,
    focusLabel: string,
    focusRunning: boolean
  ): void;
  /** JSON com as ações feitas pelo widget enquanto o app estava fechado.
   * Esvazia a fila — quem chama precisa persistir o que recebeu. */
  drainPendingActions(): string;
  setBackgroundEnabled(enabled: boolean): void;
  isBackgroundEnabled(): boolean;
  /** Sem isenção do Doze o serviço morre depois de um tempo parado. */
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): boolean;
  /** Abre a tela de Autostart do fabricante. `false` quando não existe. */
  openAutostartSettings(): boolean;
  /** Fabricantes que matam serviço mesmo com tudo certo do lado do app. */
  isAggressiveOem(): boolean;
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
