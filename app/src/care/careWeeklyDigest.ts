import type { WeeklySummaryInput, WeeklySummaryOutput } from './careUxTypes';
import type { DailyValence } from './careWeekly';

/**
 * Núcleo puro do resumo semanal por IA: qual semana, a entrada só com
 * agregados e a chave/formato do cache no aparelho (o texto não vai ao banco).
 */
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0) : null;
}

export function addDays(day: string, n: number): string {
  const date = parseDay(day);
  if (!date) return day;
  date.setDate(date.getDate() + n);
  return key(date);
}

/** Segunda-feira (local) da semana de `date`. */
export function weekStartOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return key(d);
}

/** A última semana completa (segunda a domingo) antes de hoje. */
export function lastCompleteWeekStart(now = new Date()): string {
  return addDays(weekStartOf(now), -7);
}

/** "20 a 26/10" ou "27/10 a 02/11". */
export function weekLabel(weekStart: string): string {
  const start = parseDay(weekStart);
  const end = parseDay(addDays(weekStart, 6));
  if (!start || !end) return weekStart;
  const startText = start.getMonth() === end.getMonth() ? pad(start.getDate()) : `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`;
  return `${startText} a ${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;
}

/** Chave válida para o SecureStore (só letras, números, ".", "-" e "_"). */
export function weeklyCacheKey(linkId: string, weekStart: string): string {
  return `mellowpet.care.digest.${linkId}.${weekStart}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

const count = (value: number | undefined) => Math.max(0, Math.min(100_000, Math.round(value ?? 0)));

/** Só os 7 dias da semana, só contagens — nunca leituras individuais. */
export function buildWeeklyInput(
  daily: DailyValence[],
  weekStart: string,
  openAlerts: number,
  relationship?: string | null
): WeeklySummaryInput {
  const end = addDays(weekStart, 7);
  const byDay = new Map<string, WeeklySummaryInput['days'][number]>();
  for (const d of daily) {
    const day = d.at.slice(0, 10);
    if (day < weekStart || day >= end) continue;
    const pleasant = count(d.pleasant);
    const difficult = count(d.difficult);
    const neutral = d.neutral === undefined ? Math.max(0, count(d.count) - pleasant - difficult) : count(d.neutral);
    const prev = byDay.get(day);
    const next = {
      day,
      pleasant: (prev?.pleasant ?? 0) + pleasant,
      neutral: (prev?.neutral ?? 0) + neutral,
      difficult: (prev?.difficult ?? 0) + difficult,
      total: 0,
    };
    next.total = next.pleasant + next.neutral + next.difficult;
    byDay.set(day, next);
  }
  const rel = relationship?.trim().slice(0, 40) || null;
  return {
    week_start: weekStart,
    days: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(0, 7),
    open_alerts: Math.max(0, Math.round(openAlerts)),
    relationship: rel,
  };
}

export type CachedDigest = { weekStart: string; text: string; provider: string; savedAt: string };

export function serializeDigest(weekStart: string, output: WeeklySummaryOutput, now = new Date()): string | null {
  if (!output.text) return null;
  const value: CachedDigest = { weekStart, text: output.text, provider: output.provider, savedAt: now.toISOString() };
  return JSON.stringify(value);
}

/** Lê o cache; formato estranho ou de outra semana → null. */
export function parseDigest(raw: string | null, weekStart: string): CachedDigest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CachedDigest>;
    if (value.weekStart !== weekStart || typeof value.text !== 'string' || !value.text.trim()) return null;
    return {
      weekStart,
      text: value.text,
      provider: typeof value.provider === 'string' ? value.provider : 'ia',
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
    };
  } catch {
    return null;
  }
}

/** Total de leituras da entrada (para decidir se vale chamar a IA). */
export function weekTotal(input: WeeklySummaryInput): number {
  return input.days.reduce((s, d) => s + d.total, 0);
}
