/**
 * Quantos quadros por segundo analisar, dado o estado do aparelho.
 *
 * A leitura facial é a parte mais cara do app. Com bateria baixa ou o celular
 * esquentando, analisar menos quadros quase não muda a leitura (o motor já
 * suaviza no tempo) e poupa justamente quando mais importa. Em estado
 * térmico grave a câmera para: aquecer o aparelho de alguém nunca vale uma
 * leitura de emoção.
 *
 * `thermal` segue PowerManager.THERMAL_STATUS_*: 0 nenhum, 1 leve,
 * 2 moderado, 3 grave, 4 crítico, 5 emergência, 6 desligamento.
 */
export type DeviceState = {
  base: number;
  battery: number | null;
  charging: boolean;
  lowPowerMode: boolean;
  thermal: number | null;
};

export type FpsDecision = { fps: number; reason: string | null };

export function visionFps(s: DeviceState): FpsDecision {
  if (s.thermal !== null && s.thermal >= 3) return { fps: 0, reason: 'aparelho quente — leitura pausada' };
  let fps = s.base;
  let reason: string | null = null;
  if (s.thermal === 2) {
    fps = Math.min(fps, 2);
    reason = 'aparelho aquecendo';
  } else if (s.thermal === 1) {
    fps = Math.min(fps, Math.max(2, Math.floor(s.base / 2)));
    reason = 'aparelho morno';
  }
  if (!s.charging) {
    if (s.battery !== null && s.battery < 0.15) {
      fps = Math.min(fps, 1);
      reason = 'bateria baixa';
    } else if (s.lowPowerMode || (s.battery !== null && s.battery < 0.3)) {
      fps = Math.min(fps, 2);
      reason = reason ?? 'economia de bateria';
    }
  }
  return { fps, reason };
}
