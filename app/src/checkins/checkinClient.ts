import type { EmotionKey } from '../data/emotions';
import { supabase } from '../supabase/client';
import { logManualEmotion } from '../vision/manualEmotion';
import type { Checkin, CheckinTag, DetectedRow, NewCheckin } from './checkinTypes';
import { NOTE_MAX } from './checkinTypes';

/**
 * Check-in emocional: o que a pessoa diz que sente, com contexto.
 *
 * Grava em duas tabelas de propósito. `checkins` guarda o registro completo
 * (texto, tags, sono, o que a câmera lia na hora). `emotion_events` recebe só
 * a emoção, como qualquer outra leitura manual — é dali que o dashboard, a
 * sequência de dias e a RPC do cuidador leem, e nenhum deles precisa saber que
 * o check-in existe.
 */

export {
  CHECKIN_EMOTIONS,
  CHECKIN_TAGS,
  NOTE_MAX,
  type Checkin,
  type CheckinTag,
  type DetectedRow,
  type NewCheckin,
} from './checkinTypes';

type Row = {
  id: string;
  emotion: string;
  note: string;
  tags: string[];
  sleep_quality: number | null;
  detected_emotion: string | null;
  detected_confidence: number | null;
  created_at: string;
};

const SELECT = 'id, emotion, note, tags, sleep_quality, detected_emotion, detected_confidence, created_at';

function toCheckin(row: Row): Checkin {
  return {
    id: row.id,
    emotion: row.emotion as EmotionKey,
    note: row.note,
    tags: row.tags as CheckinTag[],
    sleepQuality: row.sleep_quality,
    detectedEmotion: (row.detected_emotion as EmotionKey | null) ?? null,
    detectedConfidence: row.detected_confidence,
    createdAt: row.created_at,
  };
}

/** Tabela ausente é o erro mais provável logo após publicar: a migration
 * ainda não foi aplicada. A mensagem diz exatamente o que fazer. */
function describe(error: { code?: string; message: string }, action: string): Error {
  if (error.code === '42P01' || error.code === 'PGRST205' || /checkins.*(not exist|not found)/i.test(error.message)) {
    return new Error(
      `${action}: a tabela de check-ins ainda não existe no Supabase. ` +
        'Aplique supabase/migrations/202609160001_checkins.sql.'
    );
  }
  return new Error(`${action}: ${error.message}`);
}

export async function createCheckin(userId: string, input: NewCheckin): Promise<Checkin> {
  const note = input.note.trim().slice(0, NOTE_MAX);
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      user_id: userId,
      emotion: input.emotion,
      note,
      tags: input.tags,
      sleep_quality: input.sleepQuality,
      detected_emotion: input.detectedEmotion,
      detected_confidence: input.detectedConfidence,
    })
    .select(SELECT)
    .single();
  if (error) throw describe(error, 'Não foi possível salvar o check-in');

  // Espelho em emotion_events. Se falhar, o check-in já está salvo — não vale
  // desfazer o registro principal por causa do secundário.
  logManualEmotion(userId, input.emotion, 'checkin').catch(() => {});

  return toCheckin(data as Row);
}

export async function listCheckins(userId: string, sinceMs: number): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select(SELECT)
    .eq('user_id', userId)
    .gte('created_at', new Date(sinceMs).toISOString())
    .order('created_at', { ascending: false });
  if (error) throw describe(error, 'Não foi possível carregar os check-ins');
  return ((data ?? []) as Row[]).map(toCheckin);
}

/**
 * Só o que a câmera viu. Exclui as origens manuais — senão o espelho do
 * próprio check-in em emotion_events entraria como "detecção" e a comparação
 * concordaria consigo mesma.
 */
export async function listDetectedEvents(userId: string, sinceMs: number): Promise<DetectedRow[]> {
  const { data, error } = await supabase
    .from('emotion_events')
    .select('emotion, created_at')
    .eq('user_id', userId)
    .not('source', 'in', '(widget_manual,checkin)')
    .gte('created_at', new Date(sinceMs).toISOString())
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Não foi possível carregar as leituras: ${error.message}`);
  return (data ?? []) as DetectedRow[];
}

export async function deleteCheckin(id: string): Promise<void> {
  const { error } = await supabase.from('checkins').delete().eq('id', id);
  if (error) throw describe(error, 'Não foi possível apagar o check-in');
}
