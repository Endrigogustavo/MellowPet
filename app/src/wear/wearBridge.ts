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
  checkedInToday: boolean,
  hoursSinceReading = -1,
  caregiver: { name: string; phone: string | null } | null = null
): void {
  if (!MellowWear) return;
  try {
    MellowWear.pushState(
      emotion,
      level,
      streak,
      checkedInToday,
      hoursSinceReading,
      caregiver?.name ?? null,
      caregiver?.phone ?? null
    );
  } catch {
    // Sem relógio pareado o Data Layer rejeita; não é erro para o usuário.
  }
}

/** Alimenta a tela de música do relógio. */
export function pushNowPlayingToWatch(
  track: string | null,
  playlist: string | null,
  playing: boolean
): void {
  if (!MellowWear) return;
  try {
    MellowWear.pushNowPlaying(track, playlist, playing);
  } catch {
    // idem
  }
}

/** Comandos de mídia do relógio consideram-se velhos depois disto. Pausar
 * meio minuto atrasado é pior do que não pausar. */
const MEDIA_COMMAND_MAX_AGE_MS = 30_000;

export type WatchMediaCommand = 'toggle' | 'next' | 'prev';

/**
 * Lê o último comando de mídia que o relógio mandou, se ainda for recente.
 *
 * Só funciona com o app do celular rodando: quem fala com o Spotify é o App
 * Remote, que vive neste processo. Com o app fechado o comando se perde — e é
 * o comportamento certo para controle de mídia.
 */
export function takeWatchMediaCommand(): WatchMediaCommand | null {
  if (!MellowWear) return null;
  let raw: string;
  try {
    raw = MellowWear.takeWatchMediaCommand();
  } catch {
    return null;
  }
  if (!raw) return null;
  const [command, ageRaw] = raw.split(':');
  const age = Number(ageRaw);
  if (!Number.isFinite(age) || age > MEDIA_COMMAND_MAX_AGE_MS) return null;
  return command === 'toggle' || command === 'next' || command === 'prev' ? command : null;
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
      // Nota ditada tem prioridade sobre o batimento: é o que a pessoa disse.
      const note = c.note?.trim()
        ? c.note.trim()
        : c.heartRate
          ? `${c.heartRate} bpm no relógio`
          : '';
      await createCheckin(userId, {
        emotion: c.emotion as EmotionKey,
        note,
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
