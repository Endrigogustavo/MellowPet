import MellowWear, { isMellowWearAvailable, type WatchCheckin } from '../../modules/mellow-wear';
import { createCheckin } from '../checkins/checkinClient';
import { CHECKIN_EMOTIONS } from '../checkins/checkinTypes';
import type { EmotionKey } from '../data/emotions';

/**
 * Ponte com o relógio.
 *
 * O relógio não tem sessão do Supabase — de propósito, a credencial é do app.
 * Então ele registra e enfileira; aqui a fila vira linha no banco.
 */

export { isMellowWearAvailable };

/** Empurra o estado atual para o relógio exibir. Silencioso se não houver. */
export function pushStateToWatch(
  emotion: EmotionKey,
  level: number,
  streak: number,
  checkedInToday: boolean
): void {
  if (!MellowWear) return;
  try {
    MellowWear.pushState(emotion, level, streak, checkedInToday);
  } catch {
    // Sem relógio pareado o Data Layer rejeita; não é erro para o usuário.
  }
}

function isValid(raw: unknown): raw is WatchCheckin {
  if (typeof raw !== 'object' || raw === null) return false;
  const c = raw as Partial<WatchCheckin>;
  return (
    typeof c.emotion === 'string' &&
    (CHECKIN_EMOTIONS as string[]).includes(c.emotion) &&
    typeof c.at === 'number' &&
    Number.isFinite(c.at)
  );
}

/**
 * Grava no Supabase tudo que o relógio registrou enquanto o app estava fechado.
 *
 * A fila nativa é esvaziada ao ler. Se a gravação falhar depois disso, aquele
 * check-in se perde — aceitável para um registro de conveniência, e melhor do
 * que reprocessar em loop um item que o banco recusa (emoção inválida, por
 * exemplo). Devolve quantos entraram.
 */
export async function syncWatchCheckins(userId: string): Promise<number> {
  if (!MellowWear) return 0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(MellowWear.drainWatchCheckins());
  } catch {
    return 0;
  }
  if (!Array.isArray(parsed)) return 0;

  const valid = parsed.filter(isValid);
  let saved = 0;
  for (const c of valid) {
    try {
      await createCheckin(userId, {
        emotion: c.emotion as EmotionKey,
        // O relógio não tem teclado; a nota fica para o celular.
        note: c.heartRate ? `${c.heartRate} bpm no relógio` : '',
        tags: [],
        sleepQuality: null,
        // A câmera não existe no relógio — não há leitura para comparar, e
        // inventar uma falsearia a estatística de autopercepção × detecção.
        detectedEmotion: null,
        detectedConfidence: null,
      });
      saved++;
    } catch {
      // Um item ruim não pode travar os outros.
    }
  }
  return saved;
}
