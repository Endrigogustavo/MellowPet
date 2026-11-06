import type { Checkin, CheckinTag } from '../checkins/checkinClient';
import type { Period } from '../data/content';
import { EMOTIONS, type EmotionKey } from '../data/emotions';
import type { RoutineItem } from '../routine/routineClient';
import type { JournalEntry } from '../state/AppContext';

export type StressMode = 'off' | 'empty' | 'extreme';

export const WORST_CASE_PET_NAME =
  'Mellowzinha da Silva Sauro Imperatriz das Águas Geladas 🦭✨🫧';

export const WORST_CASE_SHORT_PET_NAME = 'M';

export const WORST_CASE_EMAIL =
  'alexandra.bartholomew.montgomery-fitzwilliam+mellowpet@departamento-clinico.exemplo.com.br';

const EXTREME_EMOTIONS: EmotionKey[] = [
  'happy',
  'neutral',
  'sad',
  'surprised',
  'angry',
  'disgusted',
  'fearful',
];

const EXTREME_TAGS: CheckinTag[] = [
  'trabalho',
  'sono',
  'familia',
  'saude',
  'faculdade',
  'amizades',
];

const EXTREME_NOTES = [
  'Dia intenso com reunião prolongada sem intervalo, olhos cansados e muita informação acumulada ao mesmo tempo 🌿🫧 (静けさを探して). Referência longa sem espaços: https://clinica-exemplo.com.br/acompanhamento/relatorio-emocional-continuo-2026-sessao-completa-de-outono',
  'Ok.',
  'Acordei cedo, caminhei 20 minutos ao sol, tomei água devagar e percebi que os ombros soltaram depois da respiração guiada com a Mellowzinha.',
  'Muitas mensagens seguidas no fim da tarde; precisei silenciar notificações por meia hora para recuperar o foco e responder com calma.',
];

/** 120 registros acumulados para estressar rolagem, truncamento, tags e carimbos de data. */
export function buildWorstCaseCheckins(count = 120): Checkin[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const emotion = EXTREME_EMOTIONS[i % EXTREME_EMOTIONS.length];
    const detected = EXTREME_EMOTIONS[(i + (i % 3 === 0 ? 0 : 2)) % EXTREME_EMOTIONS.length];
    return {
      id: `wc-checkin-${i}`,
      emotion,
      note: i % 5 === 1 ? '' : EXTREME_NOTES[i % EXTREME_NOTES.length],
      tags: i % 4 === 0 ? EXTREME_TAGS : EXTREME_TAGS.slice(0, (i % 3) + 1),
      sleepQuality: (i % 5) + 1,
      detectedEmotion: i % 6 === 0 ? null : detected,
      detectedConfidence: i % 6 === 0 ? null : 0.84,
      createdAt: new Date(now - i * 3_900_000).toISOString(),
    };
  });
}

export function buildWorstCaseRoutines(): RoutineItem[] {
  return [
    {
      id: 'wc-r-1',
      time: '06:45',
      name: 'Alongamento cervical lento, respiração 4-4-4 e copo grande de água antes de olhar notificações 🧘‍♀️💧',
      notify: true,
    },
    {
      id: 'wc-r-2',
      time: '08:00',
      name: 'A',
      notify: false,
    },
    {
      id: 'wc-r-3',
      time: '10:30',
      name: 'Pausa visual longe das telas (janela aberta + ombros soltos por dois minutos)',
      notify: true,
    },
    {
      id: 'wc-r-4',
      time: '13:15',
      name: 'Almoço tranquilo sem reuniões paralelas · https://intranet-bem-estar.exemplo.org/pausa-ativa-diaria',
      notify: true,
    },
    {
      id: 'wc-r-5',
      time: '16:40',
      name: 'Check-in rápido da tarde com registro de tensão corporal e energia',
      notify: true,
    },
    {
      id: 'wc-r-6',
      time: '19:30',
      name: 'Desacelerar luzes do quarto e ouvir trilha instrumental suave',
      notify: false,
    },
    {
      id: 'wc-r-7',
      time: '22:15',
      name: 'Fechar abas pendentes, anotar uma frase no diário e preparar descanso noturno 🌙',
      notify: true,
    },
  ];
}

export function buildWorstCaseJournal(): JournalEntry[] {
  return Array.from({ length: 18 }, (_, i) => ({
    tag: i % 2 === 0 ? 'Descompressão & Presença' : 'Alívio',
    when: i === 0 ? 'agora mesmo' : `há ${i * 3}h`,
    text:
      i % 3 === 0
        ? EXTREME_NOTES[0]
        : i % 3 === 1
          ? 'Respirei fundo.'
          : 'Consegui encerrar o bloco difícil do dia sem levar a pressa para a noite.',
  }));
}

export function buildWorstCasePeriod(): Period {
  return {
    label: '720h (teste de carga extrema)',
    wb: 68,
    events: 1482,
    timeline: [
      ['08h', 'neutral'],
      ['10h', 'happy'],
      ['12h', 'surprised'],
      ['14h', 'fearful'],
      ['16h', 'sad'],
      ['18h', 'neutral'],
      ['20h', 'happy'],
      ['22h', 'neutral'],
    ],
    triggers: [
      'Transições para tensão facial apareceram com mais frequência entre 14h e 16h30 após blocos longos sem pausa registrada.',
      'Dias com sono avaliado como "Ruim" ou "Péssimo" concentraram 64% das leituras de cansaço e retração no fim da tarde.',
      'Após sessões curtas de respiração guiada (4 ciclos), a leitura voltou para estável em média em 11 minutos.',
      'Referência longa sem quebra para validar truncamento seguro: protocolo_observacao_continua_v2_2026_11_sem_espacos_extras_no_layout.',
    ],
    insight:
      'Ao longo de 1.482 leituras neste período de teste extremo, seus momentos de maior estabilidade aconteceram pela manhã e após pausas curtas no início da noite. Quando a agenda encavalou à tarde, o rosto sinalizou tensão antes mesmo do check-in manual registrar cansaço, mostrando que pequenas pausas às 15h têm espaço real para aliviar o resto do dia.',
    dist: [
      ['Neutro e estável', 38, EMOTIONS.neutral.c],
      ['Feliz e radiante', 27, EMOTIONS.happy.c],
      ['Sinais de receio e alerta prolongado', 18, EMOTIONS.fearful.c],
      ['Triste e melancólico', 17, EMOTIONS.sad.c],
    ],
    bars: [
      ['08h', 142],
      ['11h', 268],
      ['14h', 389],
      ['17h', 312],
      ['20h', 219],
      ['23h', 152],
    ],
    peaks: [
      ['Estável', 563, EMOTIONS.neutral.c, 'neutral'],
      ['Feliz', 400, EMOTIONS.happy.c, 'happy'],
      ['Sinais de receio', 267, EMOTIONS.fearful.c, 'fearful'],
    ],
  };
}
