import { fetchEmotionEvents, type EmotionRow } from './aggregate';

const DAY_MS = 24 * 60 * 60 * 1000;

export type StreakSummary = {
  /** Dias seguidos com pelo menos uma leitura, contando de hoje para trás. */
  days: number;
  /** Últimos 7 dias, do mais antigo para hoje — se teve registro ou não. */
  week: boolean[];
};

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function summarizeStreak(rows: EmotionRow[], nowMs = Date.now()): StreakSummary {
  const active = new Set(rows.map((r) => startOfDay(new Date(r.created_at).getTime())));
  const today = startOfDay(nowMs);

  const week = Array.from({ length: 7 }, (_, i) => active.has(today - (6 - i) * DAY_MS));

  // O dia de hoje ainda pode não ter leitura sem quebrar a sequência — ela
  // só se rompe quando um dia INTEIRO passa em branco. Por isso, quando hoje
  // está vazio, a contagem começa de ontem.
  let days = 0;
  let cursor = active.has(today) ? today : today - DAY_MS;
  while (active.has(cursor)) {
    days += 1;
    cursor -= DAY_MS;
  }

  return { days, week };
}

export async function fetchStreak(userId: string): Promise<StreakSummary> {
  // 60 dias cobre qualquer sequência que valha a pena mostrar e mantém a
  // consulta barata.
  const rows = await fetchEmotionEvents(userId, Date.now() - 60 * DAY_MS);
  return summarizeStreak(rows);
}
