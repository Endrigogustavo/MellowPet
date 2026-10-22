import type { CheckinTag } from './checkinTypes';

/**
 * Sugere tags de contexto a partir do texto do diário (digitado ou ditado).
 *
 * Lista de palavras, não IA: roda no aparelho, instantâneo, e a pessoa vê
 * exatamente por que cada tag apareceu. Só sugere — quem marca é ela.
 * Casa por início de palavra e sem acento ("trabalh" pega trabalho,
 * trabalhando, trabalhei).
 */
const KEYWORDS: Record<CheckinTag, string[]> = {
  trabalho: ['trabalh', 'chefe', 'reuniao', 'emprego', 'escritorio', 'cliente', 'projeto', 'prazo', 'expediente'],
  faculdade: ['faculdade', 'facul', 'prova', 'aula', 'professor', 'tcc', 'estud', 'escola', 'trabalho em grupo', 'materia'],
  sono: ['dormi', 'sono', 'insonia', 'cansad', 'acordei', 'noite mal', 'pesadelo', 'cochil'],
  familia: ['mae', 'pai', 'irma', 'irmao', 'familia', 'filh', 'avo', 'tia', 'tio', 'primo', 'prima'],
  amizades: ['amig', 'galera', 'turma', 'colega'],
  relacionamento: ['namor', 'casad', 'marido', 'esposa', 'crush', 'termin', 'ficante', 'relacionamento'],
  saude: ['dor ', 'dores', 'doente', 'medico', 'remedio', 'gripe', 'febre', 'saude', 'terapia', 'ansiedade', 'crise'],
  dinheiro: ['dinheiro', 'conta', 'boleto', 'salario', 'divida', 'pagar', 'grana', 'aluguel', 'fatura'],
  exercicio: ['academia', 'corri', 'corrida', 'treino', 'treinei', 'exercicio', 'caminhada', 'pedal', 'yoga', 'futebol'],
  lazer: ['filme', 'serie', 'jogo', 'joguei', 'viagem', 'praia', 'passeio', 'show', 'festa', 'livro', 'musica'],
};

const plain = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function suggestTags(text: string, already: CheckinTag[] = []): CheckinTag[] {
  const t = ` ${plain(text).replace(/[^a-z0-9 ]+/g, ' ')} `;
  return (Object.keys(KEYWORDS) as CheckinTag[]).filter(
    (tag) => !already.includes(tag) && KEYWORDS[tag].some((k) => t.includes(` ${k}`))
  );
}
