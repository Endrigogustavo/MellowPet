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
  pets: number;
}): void {
  safely(() =>
    MellowWidget!.updateMood(
      input.emotion,
      input.label,
      input.level,
      input.progress,
      input.moodPct,
      input.petName,
      input.hunger,
      input.pets
    )
  );
}

export type TimelineSlot = { hour: string; emotion: string };
export type NamedCount = { name: string; count: number };
export type Goal = { name: string; done: number; target: number };

/** Alimenta os widgets do painel de uma vez — todos vêm da mesma leitura, e
 * separar em chamadas faria seis idas à ponte nativa por atualização. */
export function updateDashboardWidgets(input: {
  wellbeing: number;
  timeline: TimelineSlot[];
  triggers: NamedCount[];
  goals: Goal[];
  badges: boolean[];
  /** Décimos de hora por noite (75 = 7,5h); 0 = sem registro. */
  sleep: number[];
}): void {
  const tl = input.timeline.slice(0, 8);
  const tg = input.triggers.slice(0, 3);
  const gl = input.goals.slice(0, 3);
  // Duas chamadas porque o DSL nativo do Expo aceita no máximo 8 argumentos.
  safely(() => {
    MellowWidget!.updateDashboard(
      input.wellbeing,
      tl.map((t) => t.hour),
      tl.map((t) => t.emotion),
      input.badges.slice(0, 6),
      input.sleep.slice(0, 7)
    );
    MellowWidget!.updateInsights(
      tg.map((t) => t.name),
      tg.map((t) => t.count),
      gl.map((g) => g.name),
      gl.map((g) => g.done),
      gl.map((g) => g.target)
    );
  });
}

export type CarePerson = { name: string; state: string; wellbeing: number };

export function updateCareWidgets(input: {
  people: CarePerson[];
  alert: { title: string; sub: string } | null;
  checkin: { when: string; title: string; question: string } | null;
}): void {
  const people = input.people.slice(0, 2);
  safely(() =>
    MellowWidget!.updateCare(
      people.map((p) => p.name),
      people.map((p) => p.state),
      people.map((p) => p.wellbeing),
      input.alert?.title ?? null,
      input.alert?.sub ?? null,
      input.checkin?.when ?? null,
      input.checkin?.title ?? null,
      input.checkin?.question ?? null
    )
  );
}

export function updatePlaylistsWidget(
  playlists: { id: string; name: string; emotion: string }[]
): void {
  const four = playlists.slice(0, 4);
  safely(() =>
    MellowWidget!.updatePlaylists(
      four.map((p) => p.id),
      four.map((p) => p.name),
      four.map((p) => p.emotion)
    )
  );
}

export function updateAgendaWidget(
  next: { dow: string; day: string; title: string; sub: string } | null
): void {
  safely(() =>
    MellowWidget!.updateAgenda(
      next?.dow ?? null,
      next?.day ?? null,
      next?.title ?? null,
      next?.sub ?? null
    )
  );
}

/** Algo registrado com o app fechado — por toque no widget ou pela leitura
 * em segundo plano. */
export type PendingAction =
  | { kind: 'mood'; value: string; at: number }
  | { kind: 'vision'; value: string; at: number }
  | { kind: 'water'; value: string; at: number }
  | { kind: 'pet'; value: string; at: number };

/**
 * Recolhe o que a pessoa registrou pelos widgets enquanto o app estava
 * fechado. Esvazia a fila do lado nativo, então só chame quando for
 * realmente persistir — se descartar o resultado, os toques se perdem.
 */
export function drainPendingWidgetActions(): PendingAction[] {
  if (!isMellowWidgetAvailable || !MellowWidget) return [];
  try {
    const parsed = JSON.parse(MellowWidget.drainPendingActions());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is PendingAction =>
        a && typeof a.kind === 'string' && typeof a.value === 'string' && typeof a.at === 'number'
    );
  } catch {
    return [];
  }
}

/** Modo segundo plano: mantém os widgets respondendo com o app fechado, ao
 * custo de uma notificação permanente. */
export function setBackgroundEnabled(enabled: boolean): void {
  safely(() => MellowWidget!.setBackgroundEnabled(enabled));
}

export function isBackgroundEnabled(): boolean {
  if (!isMellowWidgetAvailable || !MellowWidget) return false;
  try {
    return MellowWidget.isBackgroundEnabled();
  } catch {
    return false;
  }
}

/**
 * O que ainda pode derrubar o serviço, do lado do sistema.
 *
 * Um serviço em primeiro plano deveria bastar, mas na prática duas coisas
 * o matam: o Doze (quando o app não está isento) e o gerenciador de
 * inicialização de fabricantes como Xiaomi. Nenhuma das duas o app resolve
 * sozinho — só a pessoa, nas telas do sistema.
 */
export type BackgroundHealth = {
  /** Isento da otimização de bateria (Doze). */
  batteryExempt: boolean;
  /** ROM conhecida por matar serviço mesmo com tudo certo. */
  aggressiveOem: boolean;
};

export function getBackgroundHealth(): BackgroundHealth {
  if (!isMellowWidgetAvailable || !MellowWidget) {
    return { batteryExempt: true, aggressiveOem: false };
  }
  try {
    return {
      batteryExempt: MellowWidget.isIgnoringBatteryOptimizations(),
      aggressiveOem: MellowWidget.isAggressiveOem(),
    };
  } catch {
    return { batteryExempt: true, aggressiveOem: false };
  }
}

/** Abre o diálogo do sistema para isentar o app do Doze. */
export function requestBatteryExemption(): void {
  safely(() => MellowWidget!.requestIgnoreBatteryOptimizations());
}

/** Abre a tela de Autostart do fabricante. Devolve `false` se não existir. */
export function openAutostartSettings(): boolean {
  if (!isMellowWidgetAvailable || !MellowWidget) return false;
  try {
    return MellowWidget.openAutostartSettings();
  } catch {
    return false;
  }
}

export function updateDailyWidgets(input: {
  water: number;
  journalTag: string;
  capsule: string | null;
  focus: { percent: number; label: string; running: boolean };
}): void {
  safely(() =>
    MellowWidget!.updateDaily(
      input.water,
      input.journalTag,
      input.capsule,
      input.focus.percent,
      input.focus.label,
      input.focus.running
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
