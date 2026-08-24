import MellowWidgets, { isMellowWidgetsAvailable } from '../../modules/mellow-widgets';
import type { EmotionKey } from '../data/emotions';

const MOOD_EMOJI: Record<EmotionKey, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  neutral: '🙂',
  surprised: '😮',
  disgusted: '😖',
  fearful: '😰',
  unknown: '🙂',
};

export function emojiForEmotion(emotion: EmotionKey): string {
  return MOOD_EMOJI[emotion] ?? '🙂';
}

/**
 * Ponte pros widgets da tela inicial. Todas as funções falham em silêncio —
 * um widget desatualizado nunca deve virar erro visível dentro do app; na
 * pior das hipóteses ele só mostra o dado antigo até a próxima chamada.
 */
export function updateMoodWidget(emoji: string, label: string, sub: string): void {
  if (!isMellowWidgetsAvailable || !MellowWidgets) return;
  try {
    MellowWidgets.updateMood(emoji, label, sub);
  } catch {
    // silencioso — ver comentário acima.
  }
}

export function updateNowPlayingWidget(
  track: string | null,
  artist: string | null,
  isPaused: boolean
): void {
  if (!isMellowWidgetsAvailable || !MellowWidgets) return;
  try {
    MellowWidgets.updateNowPlaying(track, artist, isPaused);
  } catch {
    // silencioso — ver comentário acima.
  }
}

export function updateRoutineWidget(time: string | null, name: string | null): void {
  if (!isMellowWidgetsAvailable || !MellowWidgets) return;
  try {
    MellowWidgets.updateRoutine(time, name);
  } catch {
    // silencioso — ver comentário acima.
  }
}
