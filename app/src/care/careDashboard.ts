import { EMOTIONS, type EmotionKey } from '../data/emotions';
import { DANGER, OK, WARN } from '../theme/palette';
import type { CareDashboardSummary } from './careTypes';
export { signalScore } from './careMetrics';
import { signalScore } from './careMetrics';

const NEGATIVE = new Set(['sad', 'angry', 'disgusted', 'fearful']);

export function isKnownEmotion(value: string | null): value is EmotionKey {
  return !!value && Object.prototype.hasOwnProperty.call(EMOTIONS, value);
}

export function signalColor(score: number | null): string {
  if (score === null) return WARN;
  return score >= 65 ? OK : score >= 40 ? WARN : DANGER;
}

export function formatFreshness(iso: string | null): string {
  if (!iso) return 'Sem registros neste período';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 2) return 'Atualizado agora';
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Atualizado há ${hours} h`;
  return `Último registro há ${Math.round(hours / 24)} dias`;
}

export function safeInsight(summary: CareDashboardSummary): string {
  if (summary.events === 0) return 'Ainda não há sinais suficientes para uma leitura. Um período sem dados não indica que algo esteja bem ou mal.';
  if (summary.events < 3) return 'Há poucos registros neste período. Espere mais cobertura antes de tirar conclusões.';
  const top = [...summary.distribution].sort((a, b) => b.count - a.count)[0];
  const label = top && isKnownEmotion(top.emotion) ? EMOTIONS[top.emotion].label.toLowerCase() : 'variação emocional';
  const difficult = summary.distribution.filter((row) => NEGATIVE.has(row.emotion)).reduce((sum, row) => sum + row.count, 0);
  if (difficult / summary.events >= 0.55) {
    return `Há predominância de sinais difíceis, com ${label} aparecendo mais. Isso não explica a causa: priorize um check-in calmo e o plano combinado.`;
  }
  return `O padrão mais frequente foi ${label}. Use esta visão como contexto para conversar, sem tratar leituras como certeza sobre o que a pessoa sente.`;
}
