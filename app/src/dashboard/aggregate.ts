import { EMOTIONS, type EmotionKey } from '../data/emotions';
import { supabase } from '../supabase/client';

export type EmotionRow = { emotion: string; created_at: string };

// Surpresa é ambígua: não representa melhora de bem-estar por si só.
const POSITIVE = new Set(['happy']);
const NEGATIVE = new Set(['sad', 'angry', 'disgusted', 'fearful']);

export function isEmotionKey(key: string): key is EmotionKey {
  return Object.prototype.hasOwnProperty.call(EMOTIONS, key);
}

/** Mesma fórmula que vivia em api/routers/dashboard.py — só migrada de
 * Python pro cliente, já que sem backend privilegiado a agregação roda
 * sobre linhas cruas lidas via RLS. null = sem leituras nesse recorte. */
export function wellbeingScore(rows: EmotionRow[]): number | null {
  // Sem uma amostra mínima, exibir 50/100 daria uma aparência enganosa de
  // neutralidade. A tela deve mostrar que ainda não há evidência suficiente.
  if (rows.length < 3) return null;
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    counts[r.emotion] = (counts[r.emotion] ?? 0) + 1;
  });
  const total = rows.length;
  let positivePct = 0;
  let negativePct = 0;
  for (const [emotion, count] of Object.entries(counts)) {
    const pct = (count / total) * 100;
    if (POSITIVE.has(emotion)) positivePct += pct;
    if (NEGATIVE.has(emotion)) negativePct += pct;
  }
  return Math.max(0, Math.min(100, Math.round(50 + (positivePct - negativePct) * 0.5)));
}

const MIN_TRIGGER_SAMPLES = 3;
/** Janela pra considerar que uma emoção "antecedeu" outra — eventos mais
 * distantes que isso provavelmente não têm relação causal. */
const TRANSITION_WINDOW_MS = 2 * 3_600_000;

/** Padrões temporais: (1) qual emoção mais costuma vir logo antes de uma
 * emoção negativa, e (2) em que horário cada emoção negativa mais aparece.
 * Só sugere um padrão com pelo menos `MIN_TRIGGER_SAMPLES` ocorrências —
 * abaixo disso é ruído, não um padrão útil. Isto não demonstra causalidade. */
export function triggerInsights(rows: EmotionRow[]): string[] {
  const transitions: Record<string, number> = {};
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    if (!NEGATIVE.has(curr.emotion) || prev.emotion === curr.emotion) continue;
    if (!isEmotionKey(prev.emotion) || !isEmotionKey(curr.emotion)) continue;
    const gap = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
    if (gap <= 0 || gap > TRANSITION_WINDOW_MS) continue;
    const key = `${prev.emotion}>${curr.emotion}`;
    transitions[key] = (transitions[key] ?? 0) + 1;
  }

  const hourCounts: Partial<Record<EmotionKey, Record<number, number>>> = {};
  rows.forEach((r) => {
    if (!NEGATIVE.has(r.emotion) || !isEmotionKey(r.emotion)) return;
    const hour = new Date(r.created_at).getHours();
    const forEmotion = (hourCounts[r.emotion] ??= {});
    forEmotion[hour] = (forEmotion[hour] ?? 0) + 1;
  });

  const insights: string[] = [];

  const [topTransition, topTransitionCount] =
    Object.entries(transitions).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (topTransition && topTransitionCount >= MIN_TRIGGER_SAMPLES) {
    const [fromKey, toKey] = topTransition.split('>') as [EmotionKey, EmotionKey];
    insights.push(
      `${EMOTIONS[fromKey].label} costuma anteceder ${EMOTIONS[toKey].label.toLowerCase()} (${topTransitionCount}x nesse período).`
    );
  }

  for (const [emotion, hours] of Object.entries(hourCounts) as [EmotionKey, Record<number, number>][]) {
    const [topHour, count] = Object.entries(hours).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (topHour === undefined || count < MIN_TRIGGER_SAMPLES) continue;
    insights.push(`${EMOTIONS[emotion].label} é mais frequente perto das ${topHour}h.`);
    if (insights.length >= 3) break;
  }

  return insights.slice(0, 3);
}

export async function fetchEmotionEvents(targetUserId: string, sinceMs: number): Promise<EmotionRow[]> {
  const { data, error } = await supabase
    .from('emotion_events')
    .select('emotion, created_at')
    .eq('user_id', targetUserId)
    .gte('created_at', new Date(sinceMs).toISOString())
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

/** Assina inserções novas em emotion_events para o usuário-alvo — é o que
 * faz o painel do cuidador (e o próprio dashboard) atualizar sozinho quando
 * chega uma leitura nova, sem precisar reabrir a tela. */
export function subscribeToEmotionEvents(targetUserId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`emotion_events:${targetUserId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'emotion_events', filter: `user_id=eq.${targetUserId}` },
      onInsert
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
