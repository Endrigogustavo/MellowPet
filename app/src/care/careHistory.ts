import type { CareHistoryBucket, HistoryGranularity } from './careUxTypes';
import type { DailyValence } from './careWeekly';

/**
 * Núcleo puro do histórico dia/semana/mês: períodos esperados, preenchimento
 * dos buracos (período sem leitura ≠ período ausente), agregação de reserva a
 * partir do resumo diário, tendência e descrição para leitor de tela.
 */
export const HISTORY_PERIODS: Record<HistoryGranularity, number> = { day: 14, week: 12, month: 6 };

export const GRANULARITY_LABEL: Record<HistoryGranularity, string> = { day: 'Dia', week: 'Semana', month: 'Mês' };

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

/** Início do período (dia, segunda-feira da semana ou dia 1 do mês) em AAAA-MM-DD. */
export function bucketStart(day: string, granularity: HistoryGranularity): string | null {
  const date = parseDay(day);
  if (!date) return null;
  if (granularity === 'week') {
    const offset = (date.getDay() + 6) % 7; // segunda = 0
    date.setDate(date.getDate() - offset);
  } else if (granularity === 'month') {
    date.setDate(1);
  }
  return key(date);
}

/** Os `periods` inícios de período até o atual, do mais antigo ao mais novo. */
export function expectedBuckets(granularity: HistoryGranularity, periods: number, now = new Date()): string[] {
  const current = bucketStart(key(now), granularity)!;
  const base = parseDay(current)!;
  const out: string[] = [];
  for (let i = periods - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    if (granularity === 'day') d.setDate(d.getDate() - i);
    else if (granularity === 'week') d.setDate(d.getDate() - i * 7);
    else d.setMonth(d.getMonth() - i);
    out.push(key(d));
  }
  return out;
}

const empty = (bucket: string): CareHistoryBucket => ({ bucket, total: 0, pleasant: 0, neutral: 0, difficult: 0, top_emotion: null });

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** Linhas da RPC → exatamente `periods` períodos, sem buracos. */
export function fillHistory(
  rows: Partial<CareHistoryBucket>[],
  granularity: HistoryGranularity,
  periods: number,
  now = new Date()
): CareHistoryBucket[] {
  const byBucket = new Map<string, CareHistoryBucket>();
  for (const row of rows) {
    const start = typeof row.bucket === 'string' ? bucketStart(row.bucket, granularity) : null;
    if (!start) continue;
    const prev = byBucket.get(start) ?? empty(start);
    byBucket.set(start, {
      bucket: start,
      total: prev.total + num(row.total),
      pleasant: prev.pleasant + num(row.pleasant),
      neutral: prev.neutral + num(row.neutral),
      difficult: prev.difficult + num(row.difficult),
      top_emotion: prev.top_emotion ?? (typeof row.top_emotion === 'string' ? row.top_emotion : null),
    });
  }
  return expectedBuckets(granularity, periods, now).map((bucket) => byBucket.get(bucket) ?? empty(bucket));
}

/**
 * Reserva quando a RPC care_history ainda não existe: agrega o `daily` do
 * resumo antigo (até 90 dias). Dias de servidor sem as três contagens entram
 * como neutros.
 */
export function historyFromDaily(
  daily: DailyValence[],
  granularity: HistoryGranularity,
  periods: number,
  now = new Date()
): CareHistoryBucket[] {
  const rows = daily.map((d) => {
    const pleasant = d.pleasant ?? 0;
    const difficult = d.difficult ?? 0;
    const neutral = d.neutral ?? Math.max(0, d.count - pleasant - difficult);
    return { bucket: d.at.slice(0, 10), total: pleasant + neutral + difficult, pleasant, neutral, difficult, top_emotion: null };
  });
  return fillHistory(rows, granularity, periods, now);
}

export type HistoryTrend = { kind: 'up' | 'down' | 'stable' | 'few'; text: string };

/** Compara a fração de sinais difíceis da primeira e da segunda metade do período. */
export function historyTrend(buckets: CareHistoryBucket[]): HistoryTrend {
  const half = Math.floor(buckets.length / 2);
  const share = (list: CareHistoryBucket[]) => {
    const withData = list.filter((b) => b.total > 0);
    const total = withData.reduce((s, b) => s + b.total, 0);
    return { n: withData.length, total, difficult: total ? withData.reduce((s, b) => s + b.difficult, 0) / total : 0 };
  };
  const early = share(buckets.slice(0, half));
  const late = share(buckets.slice(half));
  if (early.n < 2 || late.n < 2 || early.total < 3 || late.total < 3) {
    return { kind: 'few', text: 'Ainda há poucos períodos com leituras para falar em tendência.' };
  }
  const diff = late.difficult - early.difficult;
  if (diff >= 0.1) return { kind: 'up', text: 'Os sinais difíceis aumentaram na parte mais recente do período.' };
  if (diff <= -0.1) return { kind: 'down', text: 'Os sinais difíceis diminuíram na parte mais recente do período.' };
  return { kind: 'stable', text: 'Sem mudança grande entre o começo e o fim do período.' };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Rótulo curto do eixo: "28/10" (dia e semana) ou "out" (mês). */
export function bucketLabel(bucket: string, granularity: HistoryGranularity): string {
  const date = parseDay(bucket);
  if (!date) return bucket;
  if (granularity === 'month') return MONTHS[date.getMonth()];
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

const pct = (part: number, total: number) => Math.round((part / total) * 100);

/** Texto para leitor de tela com os números de cada período. */
export function describeHistory(buckets: CareHistoryBucket[], granularity: HistoryGranularity): string {
  const prefix = granularity === 'day' ? 'Dia' : granularity === 'week' ? 'Semana de' : 'Mês de';
  const parts = buckets.map((b) => {
    const label = granularity === 'month' ? bucketLabel(b.bucket, 'month') : bucketLabel(b.bucket, granularity);
    if (b.total === 0) return `${prefix} ${label}: sem leituras`;
    return `${prefix} ${label}: ${b.total} leitura${b.total === 1 ? '' : 's'}, ${pct(b.difficult, b.total)}% difícil, ${pct(b.neutral, b.total)}% neutro, ${pct(b.pleasant, b.total)}% agradável`;
  });
  return parts.join('; ');
}

/** Horas de resumo necessárias para a reserva (o resumo antigo aceita até 2160 h). */
export function fallbackHours(granularity: HistoryGranularity, periods: number): number {
  const days = granularity === 'day' ? periods : granularity === 'week' ? periods * 7 : periods * 31;
  return Math.min(2160, days * 24);
}
