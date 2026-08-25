import MellowWidget, { isMellowWidgetAvailable } from '../../modules/mellow-widget';

/**
 * Ponte pros widgets da tela inicial (design "MellowPet Widgets").
 * Todas as funções falham em silêncio — um widget desatualizado nunca deve
 * virar erro visível dentro do app; na pior das hipóteses ele só mostra o
 * dado antigo até a próxima chamada.
 */

/**
 * "Humor" do bichinho por emoção (0-100), vindo do design. Não é a confiança
 * da leitura nem a qualidade do sinal — é o quanto o Mellow está bem, que é
 * o número mostrado ao lado do nome dele no widget de cuidar.
 */
const MOOD_PCT: Record<string, number> = {
  happy: 93,
  neutral: 71,
  surprised: 66,
  fearful: 48,
  disgusted: 40,
  sad: 39,
  angry: 31,
  unknown: 60,
};

export function moodPctFor(emotion: string): number {
  return MOOD_PCT[emotion] ?? 60;
}

/** Estado de um item da rotina no widget, na linguagem do design. */
export type RoutineWidgetState = 'done' | 'now' | 'todo';

export type RoutineWidgetItem = {
  time: string;
  name: string;
  state: RoutineWidgetState;
};

function safely(run: () => void): void {
  if (!isMellowWidgetAvailable || !MellowWidget) return;
  try {
    run();
  } catch {
    // silencioso — ver comentário do módulo.
  }
}

export function updateMoodWidget(input: {
  emotion: string;
  label: string;
  level: number;
  progress: number;
  moodPct: number;
  petName: string;
  hunger: string;
}): void {
  safely(() =>
    MellowWidget!.updateMood(
      input.emotion,
      input.label,
      input.level,
      input.progress,
      input.moodPct,
      input.petName,
      input.hunger
    )
  );
}

export function updateNowPlayingWidget(input: {
  track: string | null;
  artist: string | null;
  isPaused: boolean;
  source: string;
  progress: number;
}): void {
  safely(() =>
    MellowWidget!.updateNowPlaying(
      input.track,
      input.artist,
      input.isPaused,
      input.source,
      input.progress
    )
  );
}

export function updateRoutineWidget(items: RoutineWidgetItem[]): void {
  const trimmed = items.slice(0, 3);
  safely(() =>
    MellowWidget!.updateRoutine(
      trimmed.map((i) => i.time),
      trimmed.map((i) => i.name),
      trimmed.map((i) => i.state)
    )
  );
}

export function updateStreakWidget(days: number, week: boolean[]): void {
  safely(() => MellowWidget!.updateStreak(days, week.slice(0, 7)));
}
