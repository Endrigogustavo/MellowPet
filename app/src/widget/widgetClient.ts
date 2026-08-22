import MellowWidget, { isMellowWidgetAvailable } from '../../modules/mellow-widget';
import { EMOTIONS, type EmotionKey } from '../data/emotions';

export { isMellowWidgetAvailable };

/** Best-effort: sem módulo nativo (iOS, Expo Go) ou qualquer falha, some
 * silenciosamente — o widget é um extra, nunca deve derrubar o app. */
export function updateWidgetMood(mood: EmotionKey) {
  if (!isMellowWidgetAvailable || !MellowWidget) return;
  const emotion = EMOTIONS[mood];
  MellowWidget.updateMoodAsync(emotion.label, emotion.c).catch(() => undefined);
}
