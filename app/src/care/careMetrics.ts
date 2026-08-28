import type { CareDashboardSummary } from './careTypes';

const NEGATIVE = new Set(['sad', 'angry', 'disgusted', 'fearful']);
const POSITIVE = new Set(['happy']);

/** Resumo de sinais com amostra mínima; nunca é diagnóstico clínico. */
export function signalScore(summary: CareDashboardSummary): number | null {
  if (summary.events < 3) return null;
  const total = summary.distribution.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;
  const positive = summary.distribution.filter((row) => POSITIVE.has(row.emotion)).reduce((sum, row) => sum + row.count, 0);
  const difficult = summary.distribution.filter((row) => NEGATIVE.has(row.emotion)).reduce((sum, row) => sum + row.count, 0);
  return Math.max(0, Math.min(100, Math.round(50 + ((positive - difficult) / total) * 50)));
}
