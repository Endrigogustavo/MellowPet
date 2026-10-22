/**
 * Divergência gentil: a pessoa disse que estava bem, mas o rosto ficou tenso
 * por um bom tempo depois.
 *
 * Não é "pegar na mentira". Quem diz "tudo bem" muitas vezes não percebeu o
 * próprio corpo, ou não quis entrar no assunto — as duas coisas são ok. Por
 * isso: no máximo uma vez por dia, só depois de tensão somada considerável,
 * e com saída fácil ("estou bem mesmo").
 */
export const DIVERGENCE_WINDOW_MS = 6 * 3600 * 1000;
export const DIVERGENCE_TENSE_MIN = 20;

const SAID_OK = new Set(['happy', 'neutral']);

export type DivergenceInput = {
  lastCheckin: { emotion: string; at: number } | null;
  /** Minutos de rosto tenso desde o último check-in. */
  tenseMinutes: number;
  now: number;
  today: string;
  lastShownDay: string | null;
};

export function shouldShowDivergence(i: DivergenceInput): boolean {
  if (!i.lastCheckin || !SAID_OK.has(i.lastCheckin.emotion)) return false;
  if (i.now - i.lastCheckin.at > DIVERGENCE_WINDOW_MS) return false;
  if (i.lastShownDay === i.today) return false;
  return i.tenseMinutes >= DIVERGENCE_TENSE_MIN;
}
