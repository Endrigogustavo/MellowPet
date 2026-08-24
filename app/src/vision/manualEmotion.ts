import { supabase } from '../supabase/client';
import type { EmotionKey } from '../data/emotions';

/** Registro manual de sentimento — vindo do widget "Como você está?" da tela
 * inicial, sem passar pelo pipeline de visão (sem sessão, sem qualidade de
 * frame, sem distribuição de confiança). Mais simples que `eventQueue.ts`
 * de propósito: aqui a pessoa já disse o que sente, não tem o que inferir. */
export async function logManualEmotion(userId: string, emotion: EmotionKey): Promise<void> {
  if (emotion === 'unknown') return;
  await supabase.from('emotion_events').insert({
    event_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    user_id: userId,
    emotion,
    confidence: 1,
    all_scores: null,
    face_detected: false,
    source: 'widget_manual',
  });
}
