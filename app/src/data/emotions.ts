export type EmotionKey =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'neutral'
  | 'surprised'
  | 'disgusted'
  | 'fearful'
  | 'unknown';

export type IntensityKey = 'calm' | 'mild' | 'moderate' | 'intense' | 'extreme';

/** Equivalente às keyframes `mp-*` do design. */
export type IdleAnim = 'float' | 'bounce' | 'shake' | 'pulse';

export type Emotion = {
  label: string;
  /** Cor da emoção (`--emo`). */
  c: string;
  /** Fundo claro da emoção (`--emoL` no tema claro). */
  l: string;
  variant: string;
  conf: number;
  intensity: IntensityKey;
  quality: number;
  anim: { kind: IdleAnim; duration: number };
  msg: string;
  tip: string;
  music: string;
  scores: [string, number][];
  plan: string[];
};

export const EMOTIONS: Record<EmotionKey, Emotion> = {
  happy: {
    label: 'Feliz',
    c: '#FFD166',
    l: '#FFF8E7',
    variant: 'radiante',
    conf: 0.91,
    intensity: 'moderate',
    quality: 82,
    anim: { kind: 'bounce', duration: 1600 },
    msg: 'Boa energia agora. Aproveita esse embalo para aquilo que você vinha adiando.',
    tip: 'Anote em uma frase o que ajudou a chegar aqui. Isso serve de âncora nos dias difíceis.',
    music: 'Playlist leve para manter o ritmo sem acelerar demais.',
    scores: [
      ['feliz', 91],
      ['surpreso', 6],
      ['neutro', 3],
    ],
    plan: [
      'Escreva o que deu certo hoje',
      'Mande a boa notícia para alguém',
      'Escolha a próxima tarefa enquanto a energia está alta',
    ],
  },
  sad: {
    label: 'Triste',
    c: '#74B9FF',
    l: '#EBF5FF',
    variant: 'melancólico',
    conf: 0.78,
    intensity: 'moderate',
    quality: 71,
    anim: { kind: 'float', duration: 4600 },
    msg: 'Tudo bem estar assim. Vamos devagar: só o próximo passo, não o dia inteiro.',
    tip: 'Uma mensagem curta para alguém de confiança já conta como um passo.',
    music: 'Sons calmos para acompanhar, sem exigir nada de você.',
    scores: [
      ['triste', 78],
      ['neutro', 14],
      ['receoso', 8],
    ],
    plan: [
      'Beba um copo de água',
      'Escreva uma frase sobre o que pesou',
      'Combine algo pequeno para amanhã',
    ],
  },
  angry: {
    label: 'Com raiva',
    c: '#FF7675',
    l: '#FFF0F0',
    variant: 'tenso',
    conf: 0.86,
    intensity: 'intense',
    quality: 76,
    anim: { kind: 'shake', duration: 900 },
    msg: 'A intensidade está alta. Trinta segundos antes de decidir ou responder qualquer coisa.',
    tip: 'Água fria no rosto por 20 segundos baixa a ativação rápido.',
    music: 'Uma batida constante ajuda a descarregar sem alimentar.',
    scores: [
      ['raiva', 86],
      ['incomodado', 9],
      ['neutro', 5],
    ],
    plan: [
      'Respire 4-4-6 por seis ciclos',
      'Água fria no rosto por 20s',
      'Escolha uma única ação para agora',
    ],
  },
  neutral: {
    label: 'Neutro',
    c: '#B2BEC3',
    l: '#F5F6F7',
    variant: 'estável',
    conf: 0.74,
    intensity: 'calm',
    quality: 80,
    anim: { kind: 'float', duration: 5500 },
    msg: 'Linha estável. Bom momento para escolher uma tarefa só e começar.',
    tip: 'Estados neutros são os melhores para o modo foco.',
    music: 'Instrumental discreto para acompanhar o trabalho.',
    scores: [
      ['neutro', 74],
      ['feliz', 15],
      ['triste', 11],
    ],
    plan: ['Escolha uma tarefa só', 'Timer de 25 minutos', 'Pausa real de 5 minutos depois'],
  },
  surprised: {
    label: 'Surpreso',
    c: '#FD79A8',
    l: '#FFF0F6',
    variant: 'alerta',
    conf: 0.8,
    intensity: 'moderate',
    quality: 74,
    anim: { kind: 'bounce', duration: 1300 },
    msg: 'Algo mudou de repente. Respire uma vez antes de reagir.',
    tip: 'Se a surpresa foi boa, registre logo: memórias boas somem rápido.',
    music: 'Algo com movimento, para acompanhar a mudança.',
    scores: [
      ['surpreso', 80],
      ['feliz', 13],
      ['medo', 7],
    ],
    plan: ['Uma respiração completa', 'Nomeie o que aconteceu', 'Decida se precisa responder agora'],
  },
  disgusted: {
    label: 'Incomodado',
    c: '#55EFC4',
    l: '#EDFFF9',
    variant: 'retraído',
    conf: 0.71,
    intensity: 'mild',
    quality: 73,
    anim: { kind: 'float', duration: 4200 },
    msg: 'Algo aí não está bom para você. Vale nomear o que é antes de seguir.',
    tip: 'Afaste-se por dois minutos do que causou o incômodo.',
    music: 'Som neutro para limpar a cabeça.',
    scores: [
      ['incomodado', 71],
      ['raiva', 18],
      ['neutro', 11],
    ],
    plan: ['Saia da situação por 2 minutos', 'Escreva o que incomodou', 'Volte com um limite claro'],
  },
  fearful: {
    label: 'Sinais de receio',
    c: '#A29BFE',
    l: '#F0EEFF',
    variant: 'alerta',
    conf: 0.76,
    intensity: 'moderate',
    quality: 72,
    anim: { kind: 'pulse', duration: 1300 },
    msg: 'Sua expressão parece mais alerta. Essa leitura combina com o que você percebe agora?',
    tip: 'Se fizer sentido, alongue a expiração e observe o ambiente antes de agir.',
    music: 'Ambiente lento e sem letra para acompanhar uma pausa.',
    scores: [
      ['receio', 76],
      ['surpresa', 15],
      ['neutro', 9],
    ],
    plan: ['Solte o ar lentamente', 'Observe se você está em segurança', 'Escolha alguém para conversar'],
  },
  unknown: {
    label: 'Sinal insuficiente',
    c: '#8B949E',
    l: '#F4F5F6',
    variant: 'aguardando',
    conf: 0,
    intensity: 'calm',
    quality: 0,
    anim: { kind: 'float', duration: 5500 },
    msg: 'Ainda não há uma leitura visual confiável. Você pode continuar usando o Mellow normalmente.',
    tip: 'Se quiser ativar a leitura, fique de frente para a câmera em um ambiente iluminado.',
    music: 'Escolha manualmente o que combina com este momento.',
    scores: [],
    plan: ['Ajuste a iluminação', 'Olhe de frente para a câmera', 'Ou siga sem usar a câmera'],
  },
};

/** Ordem do carrossel automático de detecção. */
export const ORDER: EmotionKey[] = [
  'neutral',
  'happy',
  'sad',
  'surprised',
  'angry',
  'disgusted',
  'fearful',
];

/** Olhos do bichinho — dois traços SVG por emoção (centrados em cx=35 e cx=65, cy=50). */
export const EYES: Record<EmotionKey, [string, string]> = {
  happy: ['M 29 51 q 6 -8 12 0', 'M 59 51 q 6 -8 12 0'],
  neutral: ['M 29 50.5 q 6 -6.5 12 0', 'M 59 50.5 q 6 -6.5 12 0'],
  sad: ['M 29 49 q 6 7 12 0', 'M 59 49 q 6 7 12 0'],
  angry: ['M 29 46.5 L 41 51.5', 'M 71 46.5 L 59 51.5'],
  fearful: ['M 29 50 q 6 -4 12 0', 'M 59 50 q 6 -4 12 0'],
  unknown: ['M 29 50.5 q 6 -3 12 0', 'M 59 50.5 q 6 -3 12 0'],
  surprised: [
    'M 29 50 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
    'M 59 50 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
  ],
  disgusted: ['M 29 51 q 6 -4.5 12 0', 'M 59 49.5 q 6 -3 12 0'],
};

/** Boca expressiva e polida abaixo do nariz (y = 66..73, largura equilibrada x = 42.5..57.5). */
export const MOUTH: Record<EmotionKey, string> = {
  happy: 'M 42 66.5 Q 50 73.8 58 66.5',
  neutral: 'M 43 67 Q 50 71.2 57 67',
  sad: 'M 43 71.8 Q 50 67.2 57 71.8',
  angry: 'M 43 71.5 Q 50 67.5 57 71.5',
  fearful: 'M 42.5 69.5 Q 46.2 66.5 50 69.5 Q 53.8 72.5 57.5 69.5',
  unknown: 'M 44 68.8 Q 50 70.2 56 68.8',
  surprised: 'M 50 66.8 a 3.2 3.8 0 1 0 0.1 0',
  disgusted: 'M 43 70.8 Q 50 67.2 57 69.8',
};

/** Sobrancelhas suaves e expressivas acima dos olhos (y = 35..41). */
export const BROWS: Record<EmotionKey, [string, string]> = {
  happy: ['', ''],
  neutral: ['', ''],
  sad: ['M 28.5 41.5 Q 35 39.5 41 36.5', 'M 71.5 41.5 Q 65 39.5 59 36.5'],
  angry: ['M 28.5 36.5 L 41 41.5', 'M 71.5 36.5 L 59 41.5'],
  fearful: ['M 28.5 40.5 Q 35 37.5 41 38', 'M 71.5 40.5 Q 65 37.5 59 38'],
  unknown: ['', ''],
  surprised: ['M 28.5 38 Q 35 33.8 41.5 38', 'M 71.5 38 Q 65 33.8 58.5 38'],
  disgusted: ['M 28.5 38.5 Q 35 40.2 41 40.8', 'M 71.5 40.5 Q 65 37.5 59 38'],
};

/** Boca do ícone de 24×24 usado nos cartões (`faceIcon`). */
export const FACE_ICON: Record<EmotionKey, string> = {
  happy: 'M8.5 14.5c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2',
  neutral: 'M8.5 15h7',
  sad: 'M8.5 16.5c1-1.4 2.1-2 3.5-2s2.5.6 3.5 2',
  angry: 'M8.5 16.5c1-1.4 2.1-2 3.5-2s2.5.6 3.5 2',
  fearful: 'M8.5 15.5q1.7-1.6 3.5 0 1.8 1.6 3.5 0',
  unknown: 'M9 15h6',
  surprised: 'M12 15.5a1.8 2.2 0 100 .1',
  disgusted: 'M8.5 15.6q3.5-2 7 0',
};

export const INTENSITY: Record<IntensityKey, [string, string]> = {
  calm: ['Calmo', '#5C4963'],
  mild: ['Leve', '#287D5E'],
  moderate: ['Moderado', '#9E5A10'],
  intense: ['Intenso', '#B54718'],
  extreme: ['Extremo', '#C23E3E'],
};

/** Resposta do Mellow no chat, escolhida pela emoção detectada. */
export const REPLIES: Record<EmotionKey, string> = {
  happy: 'Fico feliz de ver isso. Que tal fixar esse momento: uma frase sobre o que deu certo hoje?',
  sad: 'Obrigado por me contar. Não precisa resolver nada agora: me diga só uma coisa que pesou mais.',
  angry:
    'Faz sentido estar irritado. Antes de qualquer resposta, respire uma vez comigo. Depois a gente decide o que fazer.',
  fearful:
    'Notei sinais faciais de alerta, mas só você sabe como está se sentindo. Essa leitura combina com este momento?',
  unknown:
    'Ainda não tenho sinal visual suficiente. Se quiser, você pode me contar diretamente como está se sentindo.',
  neutral: 'Está estável agora. É um bom momento para escolher uma tarefa só e começar por ela.',
  surprised: 'Algo mudou de repente. Me conta o que aconteceu, sem pressa de reagir.',
  disgusted: 'Percebi um incômodo. Nomear o que causou já ajuda: o que exatamente te desagradou?',
};
