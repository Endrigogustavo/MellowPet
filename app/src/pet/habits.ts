/**
 * Diário de hábitos do pet: o que a pessoa fez, contado por tipo e por dia.
 *
 * É daqui que saem a personalidade (o pet fica parecido com o jeito como é
 * cuidado) e os acessórios (prêmios por constância, nunca à venda). Fica só
 * no aparelho: é ritmo de uso, não dado clínico.
 *
 * Sem IO e sem import de valor — os testes rodam direto no Node.
 */
export type HabitKind =
  | 'feed'
  | 'play'
  | 'rest'
  | 'breath'
  | 'checkin'
  | 'encounter'
  | 'music'
  | 'morning'
  | 'night'
  | 'lullaby';

export type AccessoryId = 'cachecol' | 'fones' | 'coroa' | 'faixa' | 'laco';

export type Habits = {
  v: 1;
  counts: Partial<Record<HabitKind, number>>;
  /** Dias distintos (AAAA-MM-DD, hora local) em que cada hábito aconteceu. */
  days: Partial<Record<HabitKind, string[]>>;
  /** Contagem por dia dos últimos dias — o sonho conta o "ontem". */
  daily: Record<string, Partial<Record<HabitKind, number>>>;
  equipped: AccessoryId | null;
  /** Rituais dispensados ("morning:AAAA-MM-DD"): não contam, mas não insistem. */
  dismissed?: string[];
};

export const EMPTY_HABITS: Habits = { v: 1, counts: {}, days: {}, daily: {}, equipped: null };

const KEEP_DAYS = 90;
const KEEP_DAILY = 8;

export function recordHabit(h: Habits, kind: HabitKind, day: string): Habits {
  const days = h.days[kind] ?? [];
  const nextDays = days.includes(day) ? days : [...days, day].slice(-KEEP_DAYS);
  const today = h.daily[day] ?? {};
  const daily = { ...h.daily, [day]: { ...today, [kind]: (today[kind] ?? 0) + 1 } };
  const keys = Object.keys(daily).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAILY))) delete daily[k];
  return {
    ...h,
    counts: { ...h.counts, [kind]: (h.counts[kind] ?? 0) + 1 },
    days: { ...h.days, [kind]: nextDays },
    daily,
  };
}

export const didToday = (h: Habits, kind: HabitKind, day: string) => (h.days[kind] ?? []).includes(day);

export function dismissRitual(h: Habits, ritual: 'morning' | 'night', day: string): Habits {
  const key = `${ritual}:${day}`;
  const list = h.dismissed ?? [];
  return list.includes(key) ? h : { ...h, dismissed: [...list, key].slice(-10) };
}

/** Dias em que cada ritual foi feito ou dispensado. */
export function ritualDays(h: Habits): { morning: string[]; night: string[] } {
  const skipped = (r: string) => (h.dismissed ?? []).filter((k) => k.startsWith(`${r}:`)).map((k) => k.slice(r.length + 1));
  return {
    morning: [...(h.days.morning ?? []), ...skipped('morning')],
    night: [...(h.days.night ?? []), ...skipped('night')],
  };
}

// ---------------------------------------------------------------- acessórios

export type Accessory = {
  id: AccessoryId;
  label: string;
  how: string;
  /** Quanto falta: [feito, meta]. */
  progress: (h: Habits) => [number, number];
};

const dayCount = (h: Habits, k: HabitKind) => (h.days[k] ?? []).length;
const count = (h: Habits, k: HabitKind) => h.counts[k] ?? 0;

export const ACCESSORIES: Accessory[] = [
  { id: 'cachecol', label: 'Cachecol', how: '7 noites de ritual de boa noite', progress: (h) => [dayCount(h, 'night'), 7] },
  { id: 'fones', label: 'Fones', how: 'Música em 5 dias diferentes', progress: (h) => [dayCount(h, 'music'), 5] },
  { id: 'coroa', label: 'Coroa de flores', how: 'Check-in em 7 dias diferentes', progress: (h) => [dayCount(h, 'checkin'), 7] },
  { id: 'faixa', label: 'Faixa zen', how: '10 respirações guiadas', progress: (h) => [count(h, 'breath'), 10] },
  { id: 'laco', label: 'Laço da amizade', how: 'Conhecer 3 pets de outras pessoas', progress: (h) => [count(h, 'encounter'), 3] },
];

export function isUnlocked(h: Habits, id: AccessoryId): boolean {
  const a = ACCESSORIES.find((x) => x.id === id);
  if (!a) return false;
  const [done, goal] = a.progress(h);
  return done >= goal;
}

export function unlockedAccessories(h: Habits): AccessoryId[] {
  return ACCESSORIES.filter((a) => isUnlocked(h, a.id)).map((a) => a.id);
}

/** Acessório recém-liberado por este registro (para comemorar uma vez). */
export function newlyUnlocked(before: Habits, after: Habits): AccessoryId | null {
  const was = new Set(unlockedAccessories(before));
  return unlockedAccessories(after).find((id) => !was.has(id)) ?? null;
}

// --------------------------------------------------------------- personalidade

export type Trait = 'brincalhao' | 'calmo' | 'guloso' | 'sociavel' | 'pensativo';

export const TRAIT_LABEL: Record<Trait, string> = {
  brincalhao: 'brincalhão',
  calmo: 'calmo',
  guloso: 'comilão',
  sociavel: 'sociável',
  pensativo: 'pensativo',
};

/** Fala do pet que reflete o traço principal (Home). */
export const TRAIT_LINE: Record<Trait, string> = {
  brincalhao: 'quer brincar mais um pouquinho!',
  calmo: 'adora quando vocês respiram juntos.',
  guloso: 'está de olho no próximo lanche.',
  sociavel: 'está torcendo para encontrar um amigo hoje.',
  pensativo: 'gosta de saber como foi o seu dia.',
};

/** Pesos: comer é fácil e frequente, encontrar alguém é raro. */
const WEIGHTS: Record<Trait, [HabitKind, number][]> = {
  brincalhao: [['play', 1]],
  calmo: [
    ['breath', 2],
    ['rest', 1],
    ['lullaby', 2],
  ],
  guloso: [['feed', 0.6]],
  sociavel: [['encounter', 4]],
  pensativo: [
    ['checkin', 2],
    ['morning', 1],
    ['night', 1],
  ],
};

export const MIN_ACTIONS_FOR_PERSONALITY = 12;

/**
 * Até dois traços. O segundo só entra se chegar perto do primeiro (≥ 60%) —
 * "brincalhão e calmo" tem que ser verdade, não um empate técnico.
 * null enquanto há pouca história para dizer quem o pet é.
 */
export function personality(h: Habits): Trait[] | null {
  const total = Object.values(h.counts).reduce((a, v) => a + (v ?? 0), 0);
  if (total < MIN_ACTIONS_FOR_PERSONALITY) return null;
  const scores = (Object.keys(WEIGHTS) as Trait[])
    .map((t) => [t, WEIGHTS[t].reduce((a, [k, w]) => a + count(h, k) * w, 0)] as const)
    .sort((a, b) => b[1] - a[1]);
  const [first, second] = scores;
  if (first[1] <= 0) return null;
  return second[1] >= first[1] * 0.6 ? [first[0], second[0]] : [first[0]];
}

export function parseHabits(raw: string | null): Habits {
  if (!raw) return EMPTY_HABITS;
  try {
    const p = JSON.parse(raw) as Partial<Habits>;
    if (p.v !== 1 || typeof p.counts !== 'object' || typeof p.days !== 'object') return EMPTY_HABITS;
    const equipped = ACCESSORIES.some((a) => a.id === p.equipped) ? (p.equipped as AccessoryId) : null;
    const dismissed = Array.isArray(p.dismissed) ? p.dismissed.filter((k) => typeof k === 'string') : [];
    return { v: 1, counts: p.counts ?? {}, days: p.days ?? {}, daily: p.daily ?? {}, equipped, dismissed };
  } catch {
    return EMPTY_HABITS;
  }
}
