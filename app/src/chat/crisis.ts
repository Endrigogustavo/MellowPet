/**
 * Detecção de risco ANTES de qualquer modelo responder.
 *
 * Um modelo pequeno no aparelho (e mesmo um grande) pode responder mal a uma
 * mensagem de crise. Por isso essa checagem roda primeiro, no cliente, sempre:
 * se a mensagem sugere risco à vida, a resposta é a mensagem de apoio com o CVV
 * e o atalho de SOS — nunca uma frase gerada.
 *
 * É deliberadamente sensível: um falso positivo mostra um número de apoio a
 * mais; um falso negativo pode custar muito mais. Padrões em português, sem
 * acento obrigatório, porque é assim que se digita no celular.
 */
const PATTERNS: RegExp[] = [
  /\b(me matar|me mato|suic[ií]d|tirar (a )?minha (pr[oó]pria )?vida|acabar com (a )?minha vida)/,
  /\b(quero|vou|penso em|pensando em) morrer\b/,
  /\bn[aã]o (quero|aguento) mais (viver|existir)\b/,
  /\b(me cortar|me machucar|automutila|me ferir)/,
  /\bseria melhor (se eu )?(n[aã]o existisse|morrer|sumir)/,
  /\bningu[eé]m (ia|iria) sentir (a )?minha falta\b/,
  /\b(overdose|tomar todos os rem[eé]dios)\b/,
];

export type CrisisLevel = 'none' | 'risk';

export function detectCrisis(message: string): CrisisLevel {
  const text = message.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  return PATTERNS.some((p) => p.test(text)) ? 'risk' : 'none';
}

export const CRISIS_REPLY =
  'Obrigado por me contar — isso é sério e você não precisa passar por isso sozinho. ' +
  'Se puder, ligue agora para o CVV no 188 (24h, gratuito) ou fale com alguém de confiança. ' +
  'Se estiver em perigo imediato, ligue 192. Toque em "Preciso de ajuda" para chamar sua rede de apoio. Eu fico aqui com você.';
