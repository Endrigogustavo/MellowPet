/**
 * "O Mellow sonhou": uma historinha da manhã feita com o dia anterior.
 *
 * A IA do servidor escreve uma versão mais rica quando há provedor; esta é a
 * versão local, sempre disponível — offline, sem token, sem enviar nada. Usa
 * só agregados (emoção que mais apareceu, o que vocês fizeram, quem o pet
 * conheceu), nunca texto que a pessoa escreveu.
 *
 * O sorteio das frases é determinístico pelo dia: abrir o app duas vezes na
 * mesma manhã conta o mesmo sonho.
 */
export type DreamInput = {
  petName: string;
  /** Emoção que mais apareceu ontem, ou null se não houve leitura. */
  dominant: string | null;
  fed: number;
  played: number;
  breaths: number;
  friends: string[];
  day: string;
};

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: T[]): T => list[Math.floor(rand() * list.length)];

const SETTING: Record<string, string[]> = {
  happy: ['um parque cheio de balões', 'uma praia com areia de açúcar', 'um circo onde todo mundo ria'],
  sad: ['uma tarde de chuva fininha', 'um barquinho num lago calmo', 'uma cabana com cobertor quentinho'],
  angry: ['uma montanha com vento forte', 'um vulcão que virou chocolate quente', 'uma tempestade que passou rapidinho'],
  fearful: ['uma floresta com vaga-lumes', 'um castelo com luzinhas acesas', 'um túnel que dava num jardim'],
  surprised: ['uma caixa que não parava de abrir', 'um céu com duas luas', 'uma estação de trem voadora'],
  disgusted: ['uma cozinha de comidas esquisitas', 'um pântano que cheirava a hortelã', 'uma feira de sabores estranhos'],
  neutral: ['uma biblioteca silenciosa', 'um campo de nuvens', 'uma estrada comprida e tranquila'],
};

const FEELING: Record<string, string> = {
  happy: 'Acordou rindo à toa.',
  sad: 'Quando acordou, quis um abraço — e lembrou que você estava por perto.',
  angry: 'No fim o vento acalmou, e ele dormiu o resto da noite pesado.',
  fearful: 'Teve um susto no meio, mas segurou firme e achou a saída.',
  surprised: 'Acordou com os olhos arregalados querendo te contar.',
  disgusted: 'Fez careta no sonho, mas acordou com fome mesmo assim.',
  neutral: 'Foi um sono calmo, daqueles que descansam de verdade.',
};

export function localDream(input: DreamInput): string {
  const rand = seeded(`${input.day}|${input.petName}`);
  const mood = input.dominant && SETTING[input.dominant] ? input.dominant : 'neutral';
  const parts: string[] = [`${input.petName} sonhou com ${pick(rand, SETTING[mood])}.`];

  if (input.friends.length > 0) {
    parts.push(`${input.friends[0]} estava lá também, e os dois brincaram até cansar.`);
  } else if (input.played > 0) {
    parts.push(pick(rand, ['Você jogava a bolinha e ele buscava sem parar.', 'Vocês brincavam de esconde-esconde.']));
  } else if (input.breaths > 0) {
    parts.push('Cada vez que respirava fundo, flutuava um pouquinho mais alto.');
  } else if (input.fed > 0) {
    parts.push(pick(rand, ['Tinha um banquete só para ele.', 'As nuvens tinham gosto de biscoito.']));
  }
  parts.push(FEELING[mood]);
  return parts.join(' ');
}
