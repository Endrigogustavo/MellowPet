/** Quais emoções contam como bem-estar e quais como desconforto — a única
 * fonte para o índice, os gatilhos e as correlações do check-in.
 * Surpresa é ambígua: não representa melhora de bem-estar por si só. */
export const POSITIVE: ReadonlySet<string> = new Set(['happy']);
export const NEGATIVE: ReadonlySet<string> = new Set(['sad', 'angry', 'disgusted', 'fearful']);
