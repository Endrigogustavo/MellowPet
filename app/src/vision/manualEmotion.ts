import { supabase } from '../supabase/client';
import type { EmotionKey } from '../data/emotions';

/**
 * Registro de sentimento vindo de fora do pipeline de visão da tela.
 *
 * Duas origens usam isto: o widget "Como você está?" (a pessoa diz o que
 * sente) e a leitura em segundo plano (a câmera lê com o app fechado).
 * Mais simples que `eventQueue.ts` de propósito — não há sessão de vídeo,
 * qualidade de frame nem distribuição completa para reportar.
 */
export type ManualEmotionSource = 'widget_manual' | 'background_vision';

export async function logManualEmotion(
  userId: string,
  emotion: EmotionKey,
  source: ManualEmotionSource = 'widget_manual'
): Promise<void> {
  if (emotion === 'unknown') return;
  const fromCamera = source === 'background_vision';
  await supabase.from('emotion_events').insert({
    event_id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    user_id: userId,
    emotion,
    // Registro manual é uma afirmação da pessoa; leitura da câmera é uma
    // inferência, e marcá-la como certeza total falsearia o histórico.
    confidence: fromCamera ? 0.7 : 1,
    all_scores: null,
    face_detected: fromCamera,
    source,
  });
}
