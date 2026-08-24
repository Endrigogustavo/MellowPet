import { apiPost } from '../api/client';
import { EMOTIONS, type EmotionKey } from '../data/emotions';
import type { Period } from '../data/content';
import { fetchEmotionEvents, isEmotionKey, triggerInsights, wellbeingScore, type EmotionRow } from './aggregate';

const HOURS_BY_PERIOD = [24, 72, 168];
const LABEL_BY_PERIOD = ['24 horas', '3 dias', '7 dias'];
const BUCKET_MS = 3_600_000;

type InsightResponse = { insight: string; provider: string };

/** Único pedaço que ainda passa pelo backend — precisa da chave secreta do
 * provedor de IA. Falha graciosamente: sem insight, a tela mostra as
 * métricas normalmente, só sem o texto gerado. */
async function fetchAiInsight(
  summary: { dominant: string; distribution: Record<string, number>; wellbeing_score: number; total_readings: number },
  period: string
): Promise<string> {
  try {
    const res = await apiPost<InsightResponse>('/api/v1/dashboard/insight', { summary, period });
    return res.insight;
  } catch {
    return 'Sem insight disponível no momento.';
  }
}

function bucketByHour(rows: EmotionRow[], sinceMs: number): Map<number, EmotionRow[]> {
  const buckets = new Map<number, EmotionRow[]>();
  rows.forEach((row) => {
    const hour = Math.floor((new Date(row.created_at).getTime() - sinceMs) / BUCKET_MS);
    const bucket = buckets.get(hour);
    if (bucket) bucket.push(row);
    else buckets.set(hour, [row]);
  });
  return buckets;
}

/** null = sem leituras reais nesse recorte; a tela deve cair para o
 * conteúdo de demonstração. `targetUserId` pode ser outra pessoa (um
 * cuidador olhando quem ele acompanha) — RLS decide se a leitura é permitida. */
export async function fetchDashboardPeriod(targetUserId: string, periodIndex: number): Promise<Period | null> {
  const hours = HOURS_BY_PERIOD[periodIndex] ?? 24;
  const since = Date.now() - hours * BUCKET_MS;
  const rows = await fetchEmotionEvents(targetUserId, since);
  if (rows.length === 0) return null;

  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    counts[row.emotion] = (counts[row.emotion] ?? 0) + 1;
  });
  const total = rows.length;

  const dist: Period['dist'] = Object.entries(counts)
    .filter((entry): entry is [EmotionKey, number] => isEmotionKey(entry[0]))
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => [EMOTIONS[key].label, Math.round((count / total) * 100), EMOTIONS[key].c]);

  const buckets = bucketByHour(rows, since);
  const sortedHours = [...buckets.keys()].sort((a, b) => a - b);

  const bars: Period['bars'] = sortedHours.map((hour) => {
    const at = new Date(since + hour * BUCKET_MS);
    return [`${at.getHours()}h`, buckets.get(hour)!.length];
  });

  // "Linha do dia": emoção dominante por hora real, não o exemplo estático.
  const timeline: Period['timeline'] = sortedHours.map((hour) => {
    const at = new Date(since + hour * BUCKET_MS);
    const bucketCounts: Record<string, number> = {};
    buckets.get(hour)!.forEach((row) => {
      bucketCounts[row.emotion] = (bucketCounts[row.emotion] ?? 0) + 1;
    });
    const dominant = Object.entries(bucketCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const key: EmotionKey = dominant && isEmotionKey(dominant) ? dominant : 'neutral';
    return [`${at.getHours()}h`, key];
  });

  const peaks: Period['peaks'] = Object.entries(counts)
    .filter((entry): entry is [EmotionKey, number] => isEmotionKey(entry[0]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => [EMOTIONS[key].label, count, EMOTIONS[key].c, key]);

  const wb = wellbeingScore(rows) ?? 50;
  const distributionByKey = Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, Math.round((count / total) * 100)])
  );
  const insight = await fetchAiInsight(
    { dominant: peaks[0]?.[3] ?? 'neutral', distribution: distributionByKey, wellbeing_score: wb, total_readings: total },
    LABEL_BY_PERIOD[periodIndex] ?? '24 horas'
  );

  return {
    label: LABEL_BY_PERIOD[periodIndex] ?? '24 horas',
    events: total,
    wb,
    insight,
    dist,
    bars,
    peaks,
    timeline,
    triggers: triggerInsights(rows),
  };
}

/** Série diária de bem-estar (últimos 7 dias) — usada no gráfico do
 * cuidador. Dia sem leitura nenhuma aparece como 0 (barra vazia) em vez de
 * inventar um número neutro. */
export async function fetchWeeklyTrend(targetUserId: string): Promise<number[]> {
  const days = 7;
  const since = Date.now() - days * 24 * BUCKET_MS;
  const rows = await fetchEmotionEvents(targetUserId, since);
  const dayMs = 24 * BUCKET_MS;
  const buckets: EmotionRow[][] = Array.from({ length: days }, () => []);
  rows.forEach((row) => {
    const day = Math.floor((new Date(row.created_at).getTime() - since) / dayMs);
    if (day >= 0 && day < days) buckets[day].push(row);
  });
  return buckets.map((bucket) => wellbeingScore(bucket) ?? 0);
}
