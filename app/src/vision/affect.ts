/**
 * Valência e ativação (modelo circumplexo de Russell).
 *
 * Os sete rótulos são categorias; o humor real é contínuo. Projetar a
 * distribuição de scores em dois eixos — agradável/desagradável (valência) e
 * calmo/agitado (ativação) — capta estados que nenhum rótulo cobre:
 * "cansado", "entediado", "concentrado".
 *
 * Os pesos seguem as posições clássicas de cada emoção no círculo (feliz:
 * agradável e moderadamente ativado; triste: desagradável e de baixa ativação;
 * medo e raiva: desagradáveis e muito ativados). É uma estimativa a partir do
 * rosto, e a tela diz isso.
 */
export type ScoreMap = Partial<Record<'happy' | 'sad' | 'angry' | 'surprised' | 'disgusted' | 'fearful' | 'neutral', number>>;

const V: Required<ScoreMap> = { happy: 1, surprised: 0.15, neutral: 0, sad: -0.8, angry: -0.75, disgusted: -0.7, fearful: -0.8 };
const A: Required<ScoreMap> = { happy: 0.45, surprised: 0.9, neutral: -0.35, sad: -0.55, angry: 0.8, disgusted: 0.3, fearful: 0.85 };

export type Affect = { valence: number; arousal: number; label: AffectLabel };
export type AffectLabel =
  | 'animado'
  | 'tranquilo'
  | 'tenso'
  | 'cansado'
  | 'entediado'
  | 'concentrado'
  | 'neutro';

const clip = (x: number) => Math.max(-1, Math.min(1, x));

export function affectFromScores(scores: ScoreMap, tension: number | null = null): Affect {
  let total = 0;
  let v = 0;
  let a = 0;
  for (const k of Object.keys(V) as (keyof typeof V)[]) {
    const s = scores[k] ?? 0;
    total += s;
    v += s * V[k];
    a += s * A[k];
  }
  const valence = clip(total > 0 ? v / total : 0);
  const arousal = clip(total > 0 ? a / total : 0);
  return { valence, arousal, label: labelFor(valence, arousal, tension) };
}

export function labelFor(valence: number, arousal: number, tension: number | null): AffectLabel {
  if (valence > 0.25) return arousal > 0.2 ? 'animado' : 'tranquilo';
  if (valence < -0.25) return arousal > 0.15 ? 'tenso' : 'cansado';
  // Valência perto do neutro: a ativação e a tensão desempatam.
  if (tension !== null && tension >= 0.2 && tension < 0.45 && arousal > -0.25) return 'concentrado';
  if (arousal < -0.2) return 'entediado';
  return 'neutro';
}

export const AFFECT_TEXT: Record<AffectLabel, string> = {
  animado: 'Animado',
  tranquilo: 'Tranquilo',
  tenso: 'Tenso',
  cansado: 'Cansado',
  entediado: 'Entediado',
  concentrado: 'Concentrado',
  neutro: 'Neutro',
};
