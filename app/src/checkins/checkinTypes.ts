import type { EmotionKey } from '../data/emotions';

/** Tipos e constantes do check-in, sem dependência de IO — o que as
 * agregações e os testes precisam sem puxar o cliente Supabase junto. */

/** Emoções que a pessoa pode escolher. `unknown` é estado da câmera, não
 * sentimento. */
export const CHECKIN_EMOTIONS: EmotionKey[] = [
  'happy',
  'neutral',
  'sad',
  'angry',
  'fearful',
  'surprised',
  'disgusted',
];

/** Contextos marcáveis. Conjunto fechado para as correlações terem amostra:
 * com tag livre cada pessoa inventaria dez variações de "trabalho". */
export const CHECKIN_TAGS = [
  ['trabalho', 'Trabalho'],
  ['faculdade', 'Faculdade'],
  ['sono', 'Sono'],
  ['familia', 'Família'],
  ['amizades', 'Amizades'],
  ['relacionamento', 'Relacionamento'],
  ['saude', 'Saúde'],
  ['dinheiro', 'Dinheiro'],
  ['exercicio', 'Exercício'],
  ['lazer', 'Lazer'],
] as const;

export type CheckinTag = (typeof CHECKIN_TAGS)[number][0];

export const NOTE_MAX = 280;

export type Checkin = {
  id: string;
  emotion: EmotionKey;
  note: string;
  tags: CheckinTag[];
  /** 1 = muito mal, 5 = muito bem. null = não respondeu. */
  sleepQuality: number | null;
  /** O que a câmera lia no instante do check-in. null = sem leitura confiável. */
  detectedEmotion: EmotionKey | null;
  detectedConfidence: number | null;
  createdAt: string;
};

export type NewCheckin = Omit<Checkin, 'id' | 'createdAt'>;

export type DetectedRow = { emotion: string; created_at: string };
