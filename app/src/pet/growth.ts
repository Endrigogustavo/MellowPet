/**
 * Estágios de crescimento do pet: filhote → jovem → adulto.
 *
 * Mede DIAS distintos com algum cuidado, nunca tempo de uso. Passar a tarde no
 * app conta como um dia; um dia ruim não tira nada. O pet cresce com quem
 * volta, não com quem fica.
 */

export type PetStage = 'filhote' | 'jovem' | 'adulto';

/** Dias de cuidado para virar jovem e adulto. Uma semana e um mês. */
export const JOVEM_AT = 7;
export const ADULTO_AT = 30;

export const STAGE_LABEL: Record<PetStage, string> = {
  filhote: 'Filhote',
  jovem: 'Jovem',
  adulto: 'Adulto',
};

export function stageForDays(days: number): PetStage {
  const n = Math.max(0, Math.floor(days));
  if (n >= ADULTO_AT) return 'adulto';
  if (n >= JOVEM_AT) return 'jovem';
  return 'filhote';
}

export type GrowthProgress = {
  stage: PetStage;
  /** Próximo estágio; null quando já é adulto. */
  next: PetStage | null;
  /** Dias que faltam para o próximo estágio. */
  remaining: number;
  /** 0–1 dentro do estágio atual. */
  fraction: number;
};

export function growthProgress(days: number): GrowthProgress {
  const n = Math.max(0, Math.floor(days));
  const stage = stageForDays(n);
  if (stage === 'adulto') return { stage, next: null, remaining: 0, fraction: 1 };
  const [from, to, next] = stage === 'filhote' ? [0, JOVEM_AT, 'jovem' as const] : [JOVEM_AT, ADULTO_AT, 'adulto' as const];
  return { stage, next, remaining: to - n, fraction: (n - from) / (to - from) };
}

/** Subiu de estágio entre duas contagens? Usado para a cerimônia de evolução. */
export function grewUp(before: number, after: number): PetStage | null {
  const a = stageForDays(before);
  const b = stageForDays(after);
  return a !== b && after > before ? b : null;
}

/** Proporções do desenho por estágio — o filhote tem olhos maiores e é menor. */
export const STAGE_SHAPE: Record<PetStage, { scale: number; eye: number; blush: number }> = {
  filhote: { scale: 0.84, eye: 1.22, blush: 1.25 },
  jovem: { scale: 1, eye: 1, blush: 1 },
  adulto: { scale: 1.06, eye: 0.92, blush: 0.85 },
};

/** Data local "AAAA-MM-DD". UTC partiria a noite no Brasil em dois dias. */
export function localDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
