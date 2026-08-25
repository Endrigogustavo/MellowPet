import MellowVision, { isMellowVisionAvailable } from '../../modules/mellow-vision';

/**
 * Leitura facial com o app fechado.
 *
 * É amostragem, não vigilância contínua: a cada intervalo a câmera abre por
 * alguns segundos, tira uma leitura e fecha. Roda num serviço em primeiro
 * plano com notificação permanente — desde o Android 9 é a única forma de
 * um app acessar a câmera fora da tela, e a notificação é o que deixa isso
 * visível para quem está sendo lido.
 */

export const BACKGROUND_VISION_INTERVALS = [5, 15, 30, 60] as const;

export type BackgroundVisionState = { enabled: boolean; intervalMinutes: number };

const DEFAULT: BackgroundVisionState = { enabled: false, intervalMinutes: 15 };

export function getBackgroundVision(): BackgroundVisionState {
  if (!isMellowVisionAvailable || !MellowVision) return DEFAULT;
  try {
    return MellowVision.getBackgroundVision();
  } catch {
    return DEFAULT;
  }
}

export function setBackgroundVision(enabled: boolean, intervalMinutes = 15): void {
  if (!isMellowVisionAvailable || !MellowVision) return;
  try {
    MellowVision.setBackgroundVision(enabled, intervalMinutes);
  } catch {
    // Sem módulo nativo (Expo Go) vira no-op — a tela já mostra o estado
    // desligado, então não há o que reportar.
  }
}
