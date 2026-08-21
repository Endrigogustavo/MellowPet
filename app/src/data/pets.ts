/**
 * Os doze bichinhos. Cada um é o mesmo corpo redondo com um "kit" de partes
 * SVG: orelhas, orelha interna, focinho, manchas e bico.
 */

export type PetKey =
  | 'seal'
  | 'dog'
  | 'cat'
  | 'bunny'
  | 'bear'
  | 'fox'
  | 'panda'
  | 'owl'
  | 'penguin'
  | 'hamster'
  | 'capybara'
  | 'unicorn';

export const PET_TYPES: [PetKey, string, string][] = [
  ['seal', 'Foca', '#A8B0B4'],
  ['dog', 'Cachorro', '#E9A878'],
  ['cat', 'Gatinho', '#E9959F'],
  ['bunny', 'Coelho', '#CDB6EC'],
  ['bear', 'Urso', '#C08F6D'],
  ['fox', 'Raposa', '#EE9A4E'],
  ['panda', 'Panda', '#D8D2DC'],
  ['owl', 'Coruja', '#A292C4'],
  ['penguin', 'Pinguim', '#8F8AA8'],
  ['hamster', 'Hamster', '#EDBE7C'],
  ['capybara', 'Capivara', '#B98155'],
  ['unicorn', 'Unicórnio', '#EFA3B4'],
];

/** Cor base do corpo por bichinho. */
export const PET_BODY: Record<PetKey, string> = Object.fromEntries(
  PET_TYPES.map((p) => [p[0], p[2]])
) as Record<PetKey, string>;

/** Orelhas externas (esquerda, direita). */
export const EARS: Record<PetKey, [string, string]> = {
  seal: ['', ''],
  dog: [
    'M 22 36 C 7 34 3 54 9 69 C 15 81 29 77 29 62 Z',
    'M 78 36 C 93 34 97 54 91 69 C 85 81 71 77 71 62 Z',
  ],
  cat: ['M 20 34 L 15 11 L 38 22 Z', 'M 80 34 L 85 11 L 62 22 Z'],
  bunny: [
    'M 36 27 C 29 10 31 0 38.5 1 C 46 2 44 16 44 29 Z',
    'M 64 27 C 71 10 69 0 61.5 1 C 54 2 56 16 56 29 Z',
  ],
  bear: [
    'M 6 25 a 13 13 0 1 0 26 0 a 13 13 0 1 0 -26 0',
    'M 68 25 a 13 13 0 1 0 26 0 a 13 13 0 1 0 -26 0',
  ],
  fox: ['M 18 34 L 10 7 L 39 20 Z', 'M 82 34 L 90 7 L 61 20 Z'],
  panda: [
    'M 8 21 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0',
    'M 68 21 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0',
  ],
  owl: ['M 16 30 L 20 9 L 40 21 Z', 'M 84 30 L 80 9 L 60 21 Z'],
  penguin: ['', ''],
  hamster: [
    'M 14 26 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0',
    'M 66 26 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0',
  ],
  capybara: [
    'M 16 24 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0',
    'M 68 24 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0',
  ],
  unicorn: ['M 44 24 L 50 -6 L 56 24 Z', 'M 68 30 L 78 12 L 62 20 Z'],
};

export type PetDetail = {
  /** Orelha interna. */
  i: [string, string];
  /** Focinho. */
  m: string;
  /** Manchas ao redor dos olhos / barriga do pinguim. */
  p: [string, string];
  /** Bico. */
  b: string;
  /** Bigodes: 1 mostra, 0 esconde. */
  w: number;
  /** Opacidade da barriga. */
  bel: number;
};

export const DET: Record<PetKey, PetDetail> = {
  seal: {
    i: ['', ''],
    m: 'M 27 66 a 23 17 0 1 0 46 0 a 23 17 0 1 0 -46 0',
    p: ['', ''],
    b: '',
    w: 1,
    bel: 0.22,
  },
  dog: {
    i: [
      'M 22 41 C 13 40 10 55 14 65 C 18 73 25 70 25 60 Z',
      'M 78 41 C 87 40 90 55 86 65 C 82 73 75 70 75 60 Z',
    ],
    m: 'M 32 66 a 18 13 0 1 0 36 0 a 18 13 0 1 0 -36 0',
    p: ['', ''],
    b: '',
    w: 0,
    bel: 0,
  },
  cat: {
    i: ['M 22 31 L 19 17 L 33 24 Z', 'M 78 31 L 81 17 L 67 24 Z'],
    m: 'M 34 67 a 16 11 0 1 0 32 0 a 16 11 0 1 0 -32 0',
    p: ['', ''],
    b: '',
    w: 1,
    bel: 0,
  },
  bunny: {
    i: [
      'M 37.5 26 C 33.5 13 35 6 39 7 C 43 8 42.5 17 42.5 27 Z',
      'M 62.5 26 C 66.5 13 65 6 61 7 C 57 8 57.5 17 57.5 27 Z',
    ],
    m: 'M 36 67 a 14 10 0 1 0 28 0 a 14 10 0 1 0 -28 0',
    p: ['', ''],
    b: '',
    w: 1,
    bel: 0,
  },
  bear: {
    i: [
      'M 12 25 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
      'M 74 25 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
    ],
    m: 'M 33 66 a 17 12 0 1 0 34 0 a 17 12 0 1 0 -34 0',
    p: ['', ''],
    b: '',
    w: 0,
    bel: 0,
  },
  fox: {
    i: ['M 21 31 L 15 14 L 34 23 Z', 'M 79 31 L 85 14 L 66 23 Z'],
    m: 'M 35 67 a 15 11 0 1 0 30 0 a 15 11 0 1 0 -30 0',
    p: ['', ''],
    b: '',
    w: 1,
    bel: 0,
  },
  panda: {
    i: ['', ''],
    m: 'M 34 66 a 16 11 0 1 0 32 0 a 16 11 0 1 0 -32 0',
    p: [
      'M 26 48 a 11 12 0 1 0 22 0 a 11 12 0 1 0 -22 0',
      'M 52 48 a 11 12 0 1 0 22 0 a 11 12 0 1 0 -22 0',
    ],
    b: '',
    w: 0,
    bel: 0,
  },
  owl: {
    i: ['M 20 28 L 23 15 L 34 23 Z', 'M 80 28 L 77 15 L 66 23 Z'],
    m: '',
    p: [
      'M 24 50 a 15 16 0 1 0 30 0 a 15 16 0 1 0 -30 0',
      'M 46 50 a 15 16 0 1 0 30 0 a 15 16 0 1 0 -30 0',
    ],
    b: 'M 50 58 L 43 66 L 57 66 Z',
    w: 0,
    bel: 0,
  },
  penguin: {
    i: ['', ''],
    m: '',
    p: ['M 22 54 a 27 29 0 1 0 54 0 a 27 29 0 1 0 -54 0', ''],
    b: 'M 50 60 L 41 67 L 59 67 Z',
    w: 0,
    bel: 0,
  },
  hamster: {
    i: [
      'M 19 26 a 5.5 5.5 0 1 0 11 0 a 5.5 5.5 0 1 0 -11 0',
      'M 70 26 a 5.5 5.5 0 1 0 11 0 a 5.5 5.5 0 1 0 -11 0',
    ],
    m: 'M 35 67 a 15 11 0 1 0 30 0 a 15 11 0 1 0 -30 0',
    p: ['', ''],
    b: '',
    w: 1,
    bel: 0,
  },
  capybara: {
    i: [
      'M 20 24 a 4.5 4.5 0 1 0 9 0 a 4.5 4.5 0 1 0 -9 0',
      'M 71 24 a 4.5 4.5 0 1 0 9 0 a 4.5 4.5 0 1 0 -9 0',
    ],
    m: 'M 32 68 a 18 12 0 1 0 36 0 a 18 12 0 1 0 -36 0',
    p: ['', ''],
    b: '',
    w: 0,
    bel: 0,
  },
  unicorn: {
    i: ['M 46 22 L 50 3 L 54 22 Z', ''],
    m: 'M 35 67 a 15 11 0 1 0 30 0 a 15 11 0 1 0 -30 0',
    p: ['', ''],
    b: '',
    w: 0,
    bel: 0,
  },
};

/** Cor das manchas — panda, coruja e pinguim fogem do branco padrão. */
export const PATCH_FILL: Partial<Record<PetKey, string>> = {
  panda: '#4A3550',
  owl: '#F7EFE6',
  penguin: '#FAF6F2',
};

/** Contorno da cabeça: um círculo de raio 42 no centro do viewBox 100×100. */
export const HEAD = 'M 50 8 a 42 42 0 1 0 0.1 0 Z';
