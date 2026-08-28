/** Conteúdo local do chat de apoio ao cuidador.
 *
 * Não interpreta sinais, não diagnostica e não presume o estado de nenhuma
 * pessoa. A conversa ajuda a preparar uma abordagem respeitosa e orientada a
 * ações que o cuidador pode escolher realizar.
 */
export const CARE_CHAT_PROMPTS = [
  'Como fazer um check-in sem pressionar?',
  'Me ajude a preparar uma conversa curta',
  'O que posso observar com mais cuidado?',
  'Como registrar algo para falar com a equipe?',
] as const;

export const CARE_CHAT_EMPTY_MESSAGE =
  'Este espaço ajuda você a preparar conversas e próximos passos de cuidado. Ele não interpreta dados nem substitui apoio profissional.';

export const CARE_CHAT_PLACEHOLDER = 'Escreva uma dúvida sobre o cuidado';

export function caregiverReply(input: string) {
  const text = input.toLocaleLowerCase('pt-BR');

  if (/(crise|urg[eê]ncia|risco|perigo|emerg[eê]ncia)/.test(text)) {
    return 'Se houver risco imediato ou uma emergência, acione o serviço local de emergência e os contatos definidos no plano de cuidado. Se for seguro, permaneça presente, fale com calma e siga o que já foi combinado com a pessoa e sua equipe.';
  }

  if (/(check-?in|conversa|falar|abordar|perguntar)/.test(text)) {
    return 'Você pode começar de forma simples: “Queria saber como posso estar ao seu lado hoje. Prefere conversar agora, mais tarde ou de outro jeito?” Escute sem tentar concluir o que aconteceu e combine um próximo passo apenas se a pessoa quiser.';
  }

  if (/(registr|anota|equipe|terapeuta|profissional)/.test(text)) {
    return 'Para um registro útil, separe fatos de interpretações: quando ocorreu, o que foi observado ou compartilhado, o contexto, o que você fez e o que ficou combinado. Evite rótulos ou conclusões clínicas; leve dúvidas à equipe responsável.';
  }

  if (/(observar|sinal|padr[aã]o|monitor)/.test(text)) {
    return 'Procure padrões no contexto, não conclusões isoladas: mudanças de rotina, sono, compromissos, preferências de contato e o que a própria pessoa relata. Dados ausentes ou sinais únicos não indicam, por si só, uma situação específica.';
  }

  return 'Posso ajudar a transformar isso em um próximo passo respeitoso. Se quiser, conte o contexto sem informações sensíveis: o que você gostaria de conversar, organizar ou registrar?';
}
