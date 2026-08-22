import { apiGet } from '../api/client';
import { EMOTIONS, type EmotionKey } from '../data/emotions';
import type { Period } from '../data/content';

const HOURS_BY_PERIOD = [24, 72, 168];
const LABEL_BY_PERIOD = ['24 horas', '3 dias', '7 dias'];

type OverviewResponse = {
  total_events: number;
  timeline: { hour: number; total: number }[];
  emotion_distribution: Record<string, number>;
  wellbeing_score: number | null;
  peak_emotions: [string, number][];
  ai_insight: string;
};

function isEmotionKey(key: string): key is EmotionKey {
  return Object.prototype.hasOwnProperty.call(EMOTIONS, key);
}

/** null = sem dados reais ainda; a tela deve cair para o conteúdo de demonstração. */
export async function fetchDashboardPeriod(userId: string, periodIndex: number): Promise<Period | null> {
  const hours = HOURS_BY_PERIOD[periodIndex] ?? 24;
  const data = await apiGet<OverviewResponse>('/api/v1/dashboard/overview', { user_id: userId, hours });
  if (!data.total_events) return null;

  const since = Date.now() - hours * 3600_000;

  const dist: Period['dist'] = [];
  for (const [key, pct] of Object.entries(data.emotion_distribution).sort((a, b) => b[1] - a[1])) {
    if (!isEmotionKey(key)) continue;
    dist.push([EMOTIONS[key].label, Math.round(pct), EMOTIONS[key].c]);
  }

  const bars: Period['bars'] = data.timeline.map((bucket) => {
    const at = new Date(since + bucket.hour * 3600_000);
    return [`${at.getHours()}h`, bucket.total];
  });

  const peaks: Period['peaks'] = [];
  for (const [key, count] of data.peak_emotions) {
    if (!isEmotionKey(key)) continue;
    peaks.push([EMOTIONS[key].label, count, EMOTIONS[key].c, key]);
  }

  return {
    label: LABEL_BY_PERIOD[periodIndex] ?? '24 horas',
    events: data.total_events,
    wb: Math.round(data.wellbeing_score ?? 50),
    insight: data.ai_insight,
    dist,
    bars,
    peaks,
  };
}
