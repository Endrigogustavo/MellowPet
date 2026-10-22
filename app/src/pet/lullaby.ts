/**
 * "Ninar o Mellow": jogo de biofeedback.
 *
 * O pet só adormece se o seu rosto ficar relaxado. Rosto calmo enche a
 * barra; tensão (testa franzida, mandíbula travada) esvazia duas vezes mais
 * rápido; sem rosto, pausa — sair da frente da câmera não é castigo.
 * Um minuto de relaxamento contínuo (ou somado) faz o pet dormir.
 */
export const LULLABY_MS = 60_000;
/** Abaixo disso o rosto conta como relaxado. */
export const RELAXED_TENSION = 0.3;

export type LullabyState = { progress: number; asleep: boolean; relaxed: boolean | null };

export const LULLABY_START: LullabyState = { progress: 0, asleep: false, relaxed: null };

export type FaceSignal = { ready: boolean; tension: number | null; expression: string };

export function isRelaxed(face: FaceSignal): boolean | null {
  if (!face.ready || face.tension === null) return null;
  const calmFace = face.expression === 'neutral' || face.expression === 'happy';
  return face.tension < RELAXED_TENSION && calmFace;
}

export function lullabyStep(s: LullabyState, face: FaceSignal, dtMs: number): LullabyState {
  if (s.asleep) return s;
  const relaxed = isRelaxed(face);
  const dt = Math.max(0, Math.min(dtMs, 2000));
  let progress = s.progress;
  if (relaxed === true) progress += dt / LULLABY_MS;
  else if (relaxed === false) progress -= (2 * dt) / LULLABY_MS;
  progress = Math.min(1, Math.max(0, progress));
  return { progress, asleep: progress >= 1, relaxed };
}
