/**
 * Coleção dos 12 bichinhos do MellowPet.
 *
 * Mantém a paleta canônica do Design System do MellowPet (`DESIGN.md` e `palette.ts`)
 * combinada com anatomia vetorial própria, sombreamento tonal suave e acabamento polido
 * para cada uma das 12 espécies.
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

export type PetSpec = {
  id: PetKey;
  name: string;
  colors: {
    body: string;
    shade: string;
    belly: string;
    accent: string;
    dark: string;
    blush: string;
  };
};

export const PET_SPECS: Record<PetKey, PetSpec> = {
  seal: {
    id: 'seal',
    name: 'Foca',
    colors: {
      body: '#ECE2D8',
      shade: '#D5C7BA',
      belly: '#FAF6F2',
      accent: '#4A3550',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  dog: {
    id: 'dog',
    name: 'Cachorro',
    colors: {
      body: '#E9A878',
      shade: '#CE8958',
      belly: '#FFF6EC',
      accent: '#9E5E36',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  cat: {
    id: 'cat',
    name: 'Gatinho',
    colors: {
      body: '#E9959F',
      shade: '#CF7682',
      belly: '#FFF4F5',
      accent: '#C45B6C',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  bunny: {
    id: 'bunny',
    name: 'Coelho',
    colors: {
      body: '#CDB6EC',
      shade: '#B296DA',
      belly: '#FAF6FF',
      accent: '#F3AEB6',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  bear: {
    id: 'bear',
    name: 'Urso',
    colors: {
      body: '#C08F6D',
      shade: '#A3714F',
      belly: '#FAF0E6',
      accent: '#633D28',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  fox: {
    id: 'fox',
    name: 'Raposa',
    colors: {
      body: '#EE9A4E',
      shade: '#D17B2E',
      belly: '#FFF7EE',
      accent: '#4A3550',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  panda: {
    id: 'panda',
    name: 'Panda',
    colors: {
      body: '#F2EDF5',
      shade: '#DDD4E3',
      belly: '#FFFFFF',
      accent: '#4A3550',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  owl: {
    id: 'owl',
    name: 'Coruja',
    colors: {
      body: '#A292C4',
      shade: '#8674AD',
      belly: '#F7EFE6',
      accent: '#E9A878',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  penguin: {
    id: 'penguin',
    name: 'Pinguim',
    colors: {
      body: '#7E7999',
      shade: '#645F80',
      belly: '#FAF6F2',
      accent: '#EDBE7C',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  hamster: {
    id: 'hamster',
    name: 'Hamster',
    colors: {
      body: '#EDBE7C',
      shade: '#D4A05A',
      belly: '#FFF8EE',
      accent: '#E88D96',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  capybara: {
    id: 'capybara',
    name: 'Capivara',
    colors: {
      body: '#B98155',
      shade: '#9B653B',
      belly: '#E3B996',
      accent: '#754829',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
  unicorn: {
    id: 'unicorn',
    name: 'Unicórnio',
    colors: {
      body: '#EFA3B4',
      shade: '#D68296',
      belly: '#FFF5F7',
      accent: '#F7E3B0',
      dark: '#4A3550',
      blush: '#F3AEB6',
    },
  },
};

export const PET_TYPES: [PetKey, string, string][] = [
  ['seal', 'Foca', PET_SPECS.seal.colors.body],
  ['dog', 'Cachorro', PET_SPECS.dog.colors.body],
  ['cat', 'Gatinho', PET_SPECS.cat.colors.body],
  ['bunny', 'Coelho', PET_SPECS.bunny.colors.body],
  ['bear', 'Urso', PET_SPECS.bear.colors.body],
  ['fox', 'Raposa', PET_SPECS.fox.colors.body],
  ['panda', 'Panda', PET_SPECS.panda.colors.body],
  ['owl', 'Coruja', PET_SPECS.owl.colors.body],
  ['penguin', 'Pinguim', PET_SPECS.penguin.colors.body],
  ['hamster', 'Hamster', PET_SPECS.hamster.colors.body],
  ['capybara', 'Capivara', PET_SPECS.capybara.colors.body],
  ['unicorn', 'Unicórnio', PET_SPECS.unicorn.colors.body],
];

/** Cor base do corpo por bichinho. */
export const PET_BODY: Record<PetKey, string> = Object.fromEntries(
  PET_TYPES.map((p) => [p[0], p[2]])
) as Record<PetKey, string>;

/** Contorno legado usado na marca do Splash/Login. */
export const HEAD = 'M 50 8 a 42 42 0 1 0 0.1 0 Z';
