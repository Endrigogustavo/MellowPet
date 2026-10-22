/**
 * Calibração que aprende com a pessoa.
 *
 * O motor usa os mesmos pesos para todo mundo, mas rostos não são iguais:
 * alguém com a sobrancelha naturalmente baixa "parece com raiva" o dia todo.
 * O feedback sim/não da Home e as divergências do check-in ("eu disse
 * triste, a câmera leu neutro") viram ganhos por emoção, guardados só neste
 * aparelho, que multiplicam os scores antes da votação.
 *
 * Regras de segurança do aprendizado:
 * - ganhos presos em [0.6, 1.4]: nenhuma sequência de respostas apaga ou
 *   força uma emoção;
 * - passos pequenos: uma resposta mexe ~10%, então um toque errado se desfaz;
 * - "não tenho certeza" não ensina nada;
 * - neutro não tem ganho próprio — é o resto, não uma classe a calibrar.
 */
export type CalibratedEmotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'disgusted' | 'fearful';

export type PersonalGains = Record<CalibratedEmotion, number> & { samples: number };

export const MIN_GAIN = 0.6;
export const MAX_GAIN = 1.4;

export const DEFAULT_GAINS: PersonalGains = {
  happy: 1,
  sad: 1,
  angry: 1,
  surprised: 1,
  disgusted: 1,
  fearful: 1,
  samples: 0,
};

const CALIBRATED = new Set<string>(['happy', 'sad', 'angry', 'surprised', 'disgusted', 'fearful']);
const clampGain = (g: number) => Math.min(MAX_GAIN, Math.max(MIN_GAIN, g));

function nudge(gains: PersonalGains, emotion: string, factor: number): PersonalGains {
  if (!CALIBRATED.has(emotion)) return gains;
  const key = emotion as CalibratedEmotion;
  return { ...gains, [key]: clampGain(gains[key] * factor), samples: gains.samples + 1 };
}

/** Resposta à pergunta "essa leitura combinou?". */
export function learnFromFeedback(
  gains: PersonalGains,
  readEmotion: string,
  verdict: 'yes' | 'no' | 'unsure'
): PersonalGains {
  if (verdict === 'unsure') return gains;
  // "Não" = o motor viu essa emoção onde ela não estava: fica mais exigente.
  // "Sim" = acertou: reforça de leve, bem menos do que o "não" corrige.
  return nudge(gains, readEmotion, verdict === 'no' ? 0.9 : 1.03);
}

/** Check-in com leitura da câmera: o que a pessoa disse vale como rótulo. */
export function learnFromCheckin(gains: PersonalGains, said: string, seen: string | null): PersonalGains {
  if (!seen || said === seen) return gains;
  // Leu errado: a emoção vista perde um pouco, a declarada ganha um pouco.
  return nudge(nudge(gains, seen, 0.93), said, 1.06);
}

/** Aplica os ganhos a uma distribuição e renormaliza para somar 1. */
export function applyGains<T extends Record<string, number>>(scores: T, gains: PersonalGains): T {
  const out: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(scores)) {
    const g = CALIBRATED.has(k) ? gains[k as CalibratedEmotion] : 1;
    out[k] = v * g;
    total += out[k];
  }
  if (total <= 0) return scores;
  for (const k of Object.keys(out)) out[k] /= total;
  return out as T;
}

/** Quanto a calibração já se afastou do padrão — para mostrar nos Ajustes. */
export function describeGains(gains: PersonalGains): { emotion: CalibratedEmotion; gain: number }[] {
  return (Object.keys(DEFAULT_GAINS).filter((k) => k !== 'samples') as CalibratedEmotion[])
    .map((emotion) => ({ emotion, gain: gains[emotion] }))
    .filter((e) => Math.abs(e.gain - 1) >= 0.05)
    .sort((a, b) => Math.abs(b.gain - 1) - Math.abs(a.gain - 1));
}

export function parseGains(raw: string | null): PersonalGains {
  if (!raw) return DEFAULT_GAINS;
  try {
    const p = JSON.parse(raw) as Partial<PersonalGains>;
    const out: PersonalGains = { ...DEFAULT_GAINS };
    for (const k of CALIBRATED) {
      const v = (p as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k as CalibratedEmotion] = clampGain(v);
    }
    out.samples = typeof p.samples === 'number' && p.samples >= 0 ? Math.floor(p.samples) : 0;
    return out;
  } catch {
    return DEFAULT_GAINS;
  }
}
