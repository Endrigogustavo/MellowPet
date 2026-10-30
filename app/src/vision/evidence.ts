import type { EmotionKey } from '../data/emotions';

/**
 * "Por que o Mellow achou isso?"
 *
 * O motor já calcula, para cada quadro, a intensidade de cada unidade de ação
 * facial (AU) — sobrancelha abaixada, canto da boca para baixo, e assim por
 * diante. O que faltava era mostrar isso: a leitura chegava como um rótulo e
 * uma porcentagem, sem dizer o que no rosto a produziu.
 *
 * Isso serve a duas coisas ao mesmo tempo. Torna a leitura auditável, em vez
 * de um oráculo — a pessoa pode discordar com argumento. E ensina vocabulário
 * emocional, que é parte do que o app se propõe a fazer.
 *
 * O texto descreve o que foi observado no rosto. Não afirma o que a pessoa
 * sente: um rosto tenso pode ser concentração, e a redação precisa deixar
 * espaço para isso.
 */

/** Unidades de ação que o motor mede, nos nomes que ele usa internamente. */
export type ActionUnit =
  | 'browInner'
  | 'browOuter'
  | 'browDown'
  | 'cheekRaise'
  | 'noseWrinkle'
  | 'smile'
  | 'frown'
  | 'mouthStretch'
  | 'jawOpen'
  | 'eyesClosed'
  | 'eyeWide'
  | 'eyeSquint'
  | 'mouthPress'
  | 'mouthPucker'
  | 'mouthRoll'
  | 'mouthShrug'
  | 'mouthLower'
  | 'mouthUpper'
  | 'dimple'
  | 'jawLateral';

export type ActionUnits = Record<ActionUnit, number>;

/** Como dizer cada AU em português claro, sem jargão de FACS. */
const LABEL: Record<ActionUnit, string> = {
  browInner: 'sobrancelha interna erguida',
  browOuter: 'sobrancelha externa erguida',
  browDown: 'sobrancelhas abaixadas',
  cheekRaise: 'bochechas erguidas',
  noseWrinkle: 'nariz franzido',
  smile: 'cantos da boca para cima',
  frown: 'cantos da boca para baixo',
  mouthStretch: 'boca esticada',
  jawOpen: 'boca aberta',
  eyesClosed: 'olhos fechados',
  eyeWide: 'olhos arregalados',
  eyeSquint: 'olhos apertados',
  mouthPress: 'lábios pressionados',
  mouthPucker: 'lábios franzidos',
  mouthRoll: 'lábios para dentro',
  mouthShrug: 'queixo tensionado',
  mouthLower: 'lábio inferior abaixado',
  mouthUpper: 'lábio superior erguido',
  dimple: 'covinhas marcadas',
  jawLateral: 'mandíbula deslocada',
};

/**
 * Os AUs que elevam cada emoção, na ordem em que pesam.
 *
 * Espelha os termos positivos de `scoreBlendshapeDetails`. É uma tabela
 * separada de propósito: aquelas fórmulas têm máximos entre variantes, ganho
 * multiplicativo e termos de sinergia, e decompô-las linearmente mentiria
 * sobre como o número sai. Aqui a pergunta é outra e mais simples — "o que no
 * rosto puxou para esta emoção" — e para isso a lista ordenada basta.
 *
 * O risco é a tabela e a fórmula se afastarem com o tempo. `evidence.test.mjs`
 * prende as duas: para cada AU listado, subir aquele AU tem de subir o score
 * daquela emoção. Um driver que não eleva nada é tabela desatualizada.
 */
const DRIVERS: Record<Exclude<EmotionKey, 'neutral' | 'unknown'>, ActionUnit[]> = {
  happy: ['smile', 'cheekRaise', 'dimple', 'eyeSquint'],
  sad: ['frown', 'browInner', 'eyesClosed', 'jawOpen', 'mouthLower', 'mouthPress'],
  angry: ['browDown', 'mouthPress', 'noseWrinkle', 'eyeSquint', 'frown'],
  surprised: ['jawOpen', 'eyeWide', 'browOuter', 'browInner'],
  fearful: ['eyeWide', 'mouthStretch', 'browInner', 'browOuter'],
  disgusted: ['noseWrinkle', 'mouthUpper', 'mouthPucker', 'frown'],
};

/** Abaixo disto o AU é ruído do estimador, não sinal — citar seria inventar. */
const MIN_STRENGTH = 0.08;

/** Quantos sinais mostrar. Mais que três vira lista, e ninguém lê lista. */
const MAX_SIGNALS = 3;

export type EvidenceSignal = {
  /** Frase pronta, em português. */
  label: string;
  /** 0–1, para a barra. */
  strength: number;
};

/**
 * Os sinais mais fortes que levaram a esta leitura, do maior para o menor.
 *
 * Vazio quando a emoção é neutra ou indefinida (não há o que explicar), ou
 * quando nenhum AU passou do limiar de ruído — caso em que dizer qualquer
 * coisa seria pior do que ficar calado.
 */
export function explainReading(aus: ActionUnits, emotion: EmotionKey): EvidenceSignal[] {
  const drivers = DRIVERS[emotion as keyof typeof DRIVERS];
  if (!drivers) return [];
  return drivers
    .map((au) => ({ label: LABEL[au], strength: aus[au] ?? 0 }))
    .filter((signal) => signal.strength >= MIN_STRENGTH)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, MAX_SIGNALS);
}

/** Exportado para o teste de desvio poder percorrer a mesma tabela. */
export const EVIDENCE_DRIVERS = DRIVERS;
