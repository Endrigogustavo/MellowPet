import { EMOTIONS, type EmotionKey } from '../data/emotions';
import { supabase } from '../supabase/client';

export type EmotionRow = { emotion: string; created_at: string };

const POSITIVE = new Set(['happy', 'surprised']);
const NEGATIVE = new Set(['sad', 'angry', 'disgusted', 'fearful']);

export function isEmotionKey(key: string): key is EmotionKey {
  return Object.prototype.hasOwnProperty.call(EMOTIONS, key);
}

/** Mesma fórmula que vivia em api/routers/dashboard.py — só migrada de
 * Python pro cliente, já que sem backend privilegiado a agregação roda
 * sobre linhas cruas lidas via RLS. null = sem leituras nesse recorte. */
export function wellbeingScore(rows: EmotionRow[]): number | null {
  if (rows.length === 0) return null;
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
