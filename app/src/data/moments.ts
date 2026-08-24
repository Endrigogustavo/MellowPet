import type { PlaylistEmotion } from '../playlists/playlistClient';

/**
 * Momentos: o vocabulário que a pessoa usa ("acolhimento", "sono profundo")
 * amarrado à emoção que o Mellow detecta. É isso que faz a playlist entrar
 * sozinha na hora certa em vez de ficar esperando alguém abrir a aba Música.
 *
 * Cada momento cobre uma emoção diferente — as sete que o motor consegue
 * classificar. Sem sobreposição de propósito: duas playlists disputando a
 * mesma emoção deixaria a escolha automática ambígua.
 */
export type Moment = {
  id: string;
  label: string;
  /** Quando esse momento acontece, na linguagem da pessoa. */
  sub: string;
  emotion: PlaylistEmotion;
  color: string;
  /** Busca inicial sugerida no Spotify ao montar a playlist do zero. */
  seed: string;
};

export const MOMENTS: Moment[] = [
  {
    id: 'acolhimento',
    label: 'Acolhimento',
    sub: 'Para quando a tristeza aperta',
    emotion: 'sad',
    color: '#74B9FF',
    seed: 'acolhedor calmo piano',
  },
  {
    id: 'sono',
    label: 'Sono profundo',
    sub: 'Ansiedade que não deixa dormir',
    emotion: 'fearful',
    color: '#A29BFE',
    seed: 'sleep ambient calm',
  },
  {
    id: 'descarga',
    label: 'Descarga controlada',
    sub: 'Raiva que precisa sair',
    emotion: 'angry',
    color: '#FF7675',
    seed: 'energia intensa',
  },
  {
    id: 'embalo',
    label: 'Manter o embalo',
    sub: 'Alegria que merece durar',
    emotion: 'happy',
    color: '#FFD166',
    seed: 'feel good animado',
  },
  {
    id: 'foco',
    label: 'Foco silencioso',
    sub: 'Estudo e trabalho',
    emotion: 'neutral',
    color: '#55EFC4',
    seed: 'deep focus instrumental',
  },
  {
    id: 'respiro',
    label: 'Respiro',
    sub: 'Desconforto e tensão no corpo',
    emotion: 'disgusted',
    color: '#B2BEC3',
    seed: 'relaxar respirar',
  },
  {
    id: 'curiosidade',
    label: 'Curiosidade',
    sub: 'Surpresa e vontade de explorar',
    emotion: 'surprised',
    color: '#FDCB6E',
    seed: 'descoberta indie',
  },
];

export function momentForEmotion(emotion: string): Moment | null {
  return MOMENTS.find((m) => m.emotion === emotion) ?? null;
}
