/**
 * Detecção de risco ANTES de qualquer modelo responder.
 *
 * Um modelo pequeno no aparelho (e mesmo um grande) pode responder mal a uma
 * mensagem de crise. Por isso essa checagem roda primeiro, no cliente, sempre:
 * se a mensagem sugere risco à vida, a resposta é a mensagem de apoio com o CVV
 * e o atalho de SOS — nunca uma frase gerada.
 *
 * É deliberadamente sensível: um falso positivo mostra um número de apoio a
 * mais; um falso negativo pode custar muito mais.
 *
 * Espelho exato de api/services/crisis.py: o texto é normalizado (minúsculas,
 * sem acento, espaços colapsados) e os padrões são os mesmos dos dois lados.
 * Cobrem a 1ª pessoa e a 3ª pessoa (o cuidador contando sobre outra pessoa:
 * "ele falou em se matar", "ela não quer mais viver", "anda se cortando").
 */
const PATTERNS: RegExp[] = [
  // ── 1ª pessoa ──
  /\b(me matar|me mato|suicid|tirar (a )?minha (propria )?vida|acabar com (a )?minha vida)/,
  /\b(quero|vou|penso em|pensando em) morrer\b/,
  // "queria morrer", "quero muito morrer", "tenho vontade de morrer",
  // "eu desejo morrer", "só queria sumir e morrer". Também cobre a 3ª
  // pessoa "ele quer morrer", "disse que queria morrer".
  /\b(quer\w*|desej\w*|vontade de|pens\w* em)( muito| tanto| so)? morrer\b/,
  /\bsumir e morrer\b/,
  /\bnao (quero|aguento) mais (viver|existir)\b/,
  /\b(me cortar|me machucar|automutila|me ferir)/,
  /\bseria melhor (se eu )?(nao existisse|morrer|sumir)/,
  /\bninguem (ia|iria) sentir (a )?minha falta\b/,
  /\b(overdose|tomar todos os remedios)\b/,
  // ── 3ª pessoa (o cuidador fala de alguém) ──
  // "se matar", "se mata", "se matou", "ameaçou se matar". Ficam de fora as
  // expressões do dia a dia "se matando de trabalhar", "se mata de rir".
  /\bse (matar|mata|mato|matou|matando|matasse)\b(?! de (rir|trabalhar|estudar|correr))/,
  /\bse (enforcar|enforcou|enforcando|envenenar|envenenou)\b/,
  // "anda se cortando", "se corta", "quer se machucar", "tentou se ferir".
  // "se machucou"/"se cortou" sozinhos ficam de fora: em geral é acidente.
  /\bse (cortar|corta|cortando|cortava)\b/,
  /\bse (machucando|ferindo)\b/,
  /\b(quer|queria|vai|pensa em|pensou em|tentou|tenta|ameacou|ameaca|falou em|fala em) se (machucar|ferir|cortar)\b/,
  /\bnao (quer|queria|aguenta|aguentava) mais (viver|existir)\b/,
  /\bnao (ve|vejo|via) (mais )?sentido (em viver|na vida)\b/,
  /\bfal\w* (em|de|sobre) morrer\b/,
  /\b(tirar|acabar com|por fim (a|na)) (a )?(propria|sua) vida\b/,
  /\btirar a (propria )?vida\b/,
  /\bninguem (ia|iria|vai) sentir (a )?(minha falta|sua falta|falta del[ae])\b/,
  /\bseria melhor se (ele|ela) (nao existisse|morresse|sumisse)\b/,
  /\b(tomou|tomar|tomando|engoliu) (todos os|todas as|um monte de|varios|varias|muitos|muitas) (remedios|comprimidos|pilulas|calmantes)\b/,
  /\b(pular|pulou|se jogar|se jogou) (da|de uma|do|de um) (ponte|janela|predio|sacada|viaduto|varanda)\b/,
  /\bcarta de despedida\b/,
];

export type CrisisLevel = 'none' | 'risk';

/** Minúsculas, sem acento e com espaços colapsados — igual ao `_normalize` do Python. */
export function normalizeCrisisText(message: string): string {
  return message
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function detectCrisis(message: string): CrisisLevel {
  const text = normalizeCrisisText(message);
  return PATTERNS.some((p) => p.test(text)) ? 'risk' : 'none';
}

export const CRISIS_REPLY =
  'Obrigado por me contar — isso é sério e você não precisa passar por isso sozinho. ' +
  'Se puder, ligue agora para o CVV no 188 (24h, gratuito) ou fale com alguém de confiança. ' +
  'Se estiver em perigo imediato, ligue 192. Toque em "Preciso de ajuda" para chamar sua rede de apoio. Eu fico aqui com você.';
