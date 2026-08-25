import type { EmotionKey } from './emotions';

/* ── Bem-estar ──────────────────────────────────────────────────────────── */

export type Period = {
  label: string;
  events: number;
  wb: number;
  insight: string;
  /** [rótulo, %, cor] */
  dist: [string, number, string][];
  /** [rótulo do eixo, valor] */
  bars: [string, number][];
  /** [rótulo, ocorrências, cor, emoção] */
  peaks: [string, number, string, EmotionKey][];
  /** Linha do dia com hora real e emoção dominante. */
  timeline: [string, EmotionKey][];
  /** Padrões identificados (transição de emoção, horário) — vazio quando não
   * há amostras suficientes nesse período. */
  triggers: string[];
};

export const PERIOD_LABELS = ['24h', '3 dias', '7 dias'];

/* ── Ferramentas ────────────────────────────────────────────────────────── */

export type ToolAction = 'breath' | 'home' | 'chat';

export type Tool = {
  title: string;
  sub: string;
  icon: string;
  accent: boolean;
  act: ToolAction;
};

export const TOOL_LIST: Tool[] = [
  {
    title: 'Respiração guiada',
    sub: '1 minuto para desacelerar',
    icon: 'M12 4c3.2 0 5.6 2.4 5.6 5.3 0 4-5.6 10.7-5.6 10.7S6.4 13.3 6.4 9.3C6.4 6.4 8.8 4 12 4z',
    accent: true,
    act: 'breath',
  },
  {
    title: 'Aterramento',
    sub: '5-4-3-2-1 para voltar ao presente',
    icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 2.5 15.6 0 18',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Body scan',
    sub: 'Escaneie o corpo e solte tensões',
    icon: 'M12 4.5a2 2 0 100 .1M12 7v7M9 20l3-6 3 6M7.5 10h9',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Visualização',
    sub: 'Cenário guiado para relaxar',
    icon: 'M4 18l5-6 3.5 4L15 13l5 5M4 6h16v12H4z',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Afirmações',
    sub: 'Frases positivas para hoje',
    icon: 'M4 6h16v10H9l-5 4V6z',
    accent: true,
    act: 'chat',
  },
  {
    title: 'Roda emocional',
    sub: 'Explore nuances do que sente',
    icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v9l7 4',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Diário',
    sub: 'Uma frase sobre o dia já basta',
    icon: 'M6 4h10l4 4v12H6zM16 4v4h4M9 13h7M9 16.5h5',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Modo foco',
    sub: '25 minutos, uma tarefa só',
    icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
    accent: false,
    act: 'home',
  },
  {
    title: 'Meditação guiada',
    sub: '5 minutos conduzidos passo a passo',
    icon: 'M12 4a2 2 0 100 .1M12 8v5M5 20l7-5 7 5M6 12h12',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Relaxamento muscular',
    sub: 'Contrair e soltar, por grupo',
    icon: 'M6 8v8M18 8v8M6 12h12M3 10v4M21 10v4',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Reestruturar pensamento',
    sub: 'Troque o pensamento automático',
    icon: 'M9 18h6M10 21h4M12 3a6 6 0 014 10.5V16H8v-2.5A6 6 0 0112 3z',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Gratidão',
    sub: 'Três coisas, por menores que sejam',
    icon: 'M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z',
    accent: true,
    act: 'chat',
  },
  {
    title: 'Conexão',
    sub: 'Uma mensagem curta muda o dia',
    icon: 'M16 18v-1.5a3 3 0 00-3-3H7a3 3 0 00-3 3V18M10 5.5a3 3 0 100 6 3 3 0 000-6M19 18v-1.5a3 3 0 00-2.2-2.9',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Higiene do sono',
    sub: 'Rotina para dormir melhor hoje',
    icon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Energia rápida',
    sub: '2 minutos para sair da inércia',
    icon: 'M13 3L5 14h6l-1 7 8-11h-6z',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Playlist da emoção',
    sub: 'Faixas escolhidas pelo seu estado',
    icon: 'M9 18V5l10-2v13M9 18a2.6 2.6 0 11-5.2 0A2.6 2.6 0 019 18zm10-2a2.6 2.6 0 11-5.2 0 2.6 2.6 0 015.2 0z',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Alongamento',
    sub: 'Pescoço, ombros e costas em 2 min',
    icon: 'M12 4a2 2 0 100 .1M12 7v6M8 21l4-8 4 8M6 10l6 2 6-2',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Pausa de água',
    sub: 'O corpo responde antes da cabeça',
    icon: 'M12 3.5S6 10 6 14a6 6 0 0012 0c0-4-6-10.5-6-10.5z',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Autocompaixão',
    sub: 'Fale consigo como falaria com um amigo',
    icon: 'M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
    accent: true,
    act: 'chat',
  },
  {
    title: 'Entender a emoção',
    sub: 'Para que ela serve e o que fazer',
    icon: 'M5 4h11l3 3v13H5zM16 4v3h3M9 12h6M9 15.5h4',
    accent: false,
    act: 'chat',
  },
  {
    title: 'Resfriar',
    sub: 'Água fria no rosto por 20 segundos',
    icon: 'M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9',
    accent: false,
    act: 'chat',
  },
];

export const JOURNAL_TAGS = ['Alívio', 'Cansaço', 'Medo', 'Orgulho', 'Saudade', 'Raiva'];

export const GROUND = [
  'Encontre 5 coisas que você consegue ver agora. Diga em voz baixa.',
  'Agora 4 coisas que você pode tocar. Toque de verdade em cada uma.',
  'Escute: 3 sons diferentes, um por vez.',
  '2 coisas que você pode cheirar — ou lembrar do cheiro.',
  '1 coisa que você pode saborear. Um copo de água serve.',
];

/** [nome, feito, total] */
/* ── Música ─────────────────────────────────────────────────────────────── */

export type Track = {
  title: string;
  artist: string;
  /** URL direta do MP3. */
  url: string;
  /** Duração em segundos, usada para o total da playlist. */
  duration: number;
};

export type Playlist = {
  id: string;
  name: string;
  why: string;
  c: string;
  tracks: Track[];
  /** Playlist editorial equivalente no Spotify, tocada via App Remote quando
   * a conta estiver conectada — mesmo clima da playlist local de Chopin. */
  spotifyUri: string;
};

/**
 * Gravações da "Musopen — Complete Chopin Collection" no Internet Archive,
 * dedicadas ao domínio público (CC0). São arquivos MP3 servidos por HTTPS com
 * suporte a range requests, então tocam por streaming sem precisar baixar.
 *
 * https://archive.org/details/musopen-chopin
 */
const MUSOPEN = 'https://archive.org/download/musopen-chopin/';

function track(title: string, file: string, duration: number): Track {
  return { title, artist: 'Chopin · Musopen', url: MUSOPEN + encodeURIComponent(file), duration };
}

export const PLAYLISTS: Playlist[] = [
  {
    id: 'acolhimento',
    name: 'Acolhimento',
    why: 'Tristeza que passa de 3 minutos',
    c: '#74B9FF',
    spotifyUri: 'spotify:playlist:37i9dQZF1DX3YSRoSdA634', // Life Sucks
    tracks: [
      track('Noturno Op. 9 nº 2', 'Nocturne Op. 9 no. 2 in E flat major.mp3', 276),
      track('Noturno Op. 15 nº 1', 'Nocturne Op. 15 no. 1 In F major.mp3', 305),
      track('Noturno Op. 55 nº 2', 'Nocturne Op. 55 no. 2 in E flat major.mp3', 309),
      track('Noturno Op. 32 nº 2', 'Nocturne Op. 32 no. 2 in A flat major.mp3', 343),
    ],
  },
  {
    id: 'quebra',
    name: 'Quebra de padrão',
    why: 'Mesma emoção travada há muito tempo',
    c: '#B2BEC3',
    spotifyUri: 'spotify:playlist:37i9dQZF1DX4WYpdgoIcn6', // Chill Hits
    tracks: [
      track('Fantaisie-Impromptu Op. 66', 'Fantasie Impromptu Op. 66.mp3', 326),
      track('Impromptu nº 1, Op. 29', 'Impromptu no. 1 - Op. 29.mp3', 280),
      track('Tarantela Op. 43', 'TarantelleOp.43.mp3', 197),
      track('Prelúdio Op. 28 nº 19', 'Prelude Op. 28 no. 19.mp3', 257),
    ],
  },
  {
    id: 'sono',
    name: 'Sono profundo',
    why: 'Ansiedade depois das 22h',
    c: '#A29BFE',
    spotifyUri: 'spotify:playlist:37i9dQZF1DX4sWSpwq3LiO', // Peaceful Piano
    tracks: [
      track('Prelúdio Op. 28 nº 15', 'Prelude Op. 28 no. 15.mp3', 295),
      track('Noturno Op. 27 nº 1', 'Nocturne Op. 27 no. 1 in C sharp minor.mp3', 352),
      track('Noturno Op. 55 nº 1', 'Nocturne Op. 55 no. 1 in F minor.mp3', 316),
      track(
        'Noturno B. 49 em dó sustenido menor',
        "Nocturne B. 49 in C sharp minor 'Lento con gran espressione' (1).mp3",
        238
      ),
    ],
  },
  {
    id: 'descarga',
    name: 'Descarga controlada',
    why: 'Raiva intensa',
    c: '#FF7675',
    spotifyUri: 'spotify:playlist:37i9dQZF1DX76Wlfdnj7AP', // Beast Mode
    tracks: [
      track('Polonaise Op. 53 · Heroica', 'PolonaiseOp.53InAFlatMajorheroic.mp3', 438),
      track('Balada nº 1, Op. 23', 'Ballade no. 1 - Op. 23.mp3', 613),
      track('Prelúdio Op. 28 nº 24', 'Prelude Op. 28 no. 24.mp3', 157),
      track('Prelúdio Op. 28 nº 16', 'Prelude Op. 28 no. 16.mp3', 75),
    ],
  },
  {
    id: 'embalo',
    name: 'Manter o embalo',
    why: 'Alegria em alta',
    c: '#FFD166',
    spotifyUri: 'spotify:playlist:37i9dQZF1DX3rxVfibe1L0', // Mood Booster
    tracks: [
      track(
        'Grande Valsa Brilhante Op. 18',
        'Grande Valse Brilliante Op.18 In E flat major.mp3',
        319
      ),
      track('Valsa Op. 64 nº 1', 'Waltz Op. 64 no. 1 in D flat major.mp3', 107),
      track('Valsa Op. 70 nº 3', 'Waltz Op. 70 no. 3 in D flat major.mp3', 170),
      track('Mazurca Op. 50 nº 1', 'Mazurka Op. 50 no. 1 in G major.mp3', 171),
    ],
  },
  {
    id: 'foco',
    name: 'Foco silencioso',
    why: 'Estudo e trabalho',
    c: '#55EFC4',
    spotifyUri: 'spotify:playlist:37i9dQZF1DWZeKCadgRdKQ', // Deep Focus
    tracks: [
      track('Noturno Op. 32 nº 1', 'Nocturne Op. 32 no. 1 in B major.mp3', 301),
      track('Prelúdio Op. 28 nº 17', 'Prelude Op. 28 no. 17.mp3', 180),
      track('Prelúdio Op. 28 nº 13', 'Prelude Op. 28 no. 13.mp3', 167),
      track('Noturno Op. 62 nº 2', 'Nocturne Op. 62 no. 2 in E major.mp3', 339),
      track('Prelúdio Op. 28 nº 7', 'Prelude Op. 28 no. 7.mp3', 155),
    ],
  },
];

/** Quantidade de faixas e duração total — derivadas, nunca digitadas à mão. */
export function playlistMeta(p: Playlist): { count: number; minutes: number } {
  const total = p.tracks.reduce((sum, t) => sum + t.duration, 0);
  return { count: p.tracks.length, minutes: Math.round(total / 60) };
}

/** `mm:ss` a partir de segundos. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** [chave da regra, gatilho, playlist] */
export const MUSIC_RULES: [string, string, string][] = [
  ['sad3', 'Tristeza por mais de 3 min', 'Acolhimento'],
  ['stuck', 'Mesma emoção por mais de 20 min', 'Quebra de padrão'],
  ['night', 'Ansiedade depois das 22h', 'Sono profundo'],
  ['anger', 'Raiva intensa detectada', 'Descarga controlada'],
  ['happy', 'Alegria sustentada', 'Manter o embalo'],
];

export const EMO_PLAYLIST: Record<EmotionKey, string> = {
  sad: 'acolhimento',
  fearful: 'sono',
  angry: 'descarga',
  happy: 'embalo',
  neutral: 'foco',
  surprised: 'quebra',
  disgusted: 'quebra',
  unknown: 'foco',
};

/* ── Cuidador ───────────────────────────────────────────────────────────── */

export type CarePerson = {
  id: string;
  name: string;
  rel: string;
  wb: number;
  status: string;
  last: string;
  color: string;
  /** [texto, quando, cor] */
  alerts: [string, string, string][];
  ai: string;
  plan: string[];
};

export const CARE_RELS = [
  'Mãe/Pai',
  'Responsável',
  'Cônjuge',
  'Filho/Filha',
  'Terapeuta',
  'Educador',
];

/** [chave, rótulo, descrição] */
export const CARE_SCOPES: [string, string, string][] = [
  ['scopeEmotion', 'Emoção do dia', 'O rótulo e a intensidade, sem imagem'],
  ['scopeAlerts', 'Alertas prolongados', 'Aviso quando uma emoção negativa persiste'],
  ['scopeTrends', 'Tendências semanais', 'Gráficos agregados, sem eventos isolados'],
  ['scopeChat', 'Conversas com o Mellow', 'Fica privado por padrão'],
];

/** [título, subtítulo, ícone, tela de destino] */
export const CARE_QUICK: [string, string, string, string][] = [
  ['Ver alertas', 'Avisos recentes', 'M12 4a6 6 0 016 6v4l2 3H4l2-3v-4a6 6 0 016-6zM10 20h4', 'care'],
  ['Relatório', 'Semana pronta', 'M6 4h10l4 4v12H6zM16 4v4h4M9 13h7M9 16.5h5', 'dashboard'],
  ['Conversar', 'Roteiro por idade', 'M20 12a8 8 0 01-11.5 7.2L4 20l.9-4.3A8 8 0 1120 12z', 'chat'],
  [
    'Plano de crise',
    'Combine com quem você cuida',
    'M12 8v5M12 16.5h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
    'caretools',
  ],
];

/** [título, subtítulo, ícone] */
export const CARE_TOOLS: [string, string, string][] = [
  ['Relatório semanal', 'PDF pronto para o terapeuta', 'M6 4h10l4 4v12H6zM16 4v4h4M9 13h7M9 16.5h5'],
  ['Definir alertas', 'Quando você quer ser avisado', 'M12 4a6 6 0 016 6v4l2 3H4l2-3v-4a6 6 0 016-6zM10 20h4'],
  ['Combinar limites', 'O que você vê e o que não vê', 'M7 11V8a5 5 0 0110 0v3M5 11h14v9H5z'],
  ['Conversar', 'Roteiros de conversa por idade', 'M20 12a8 8 0 01-11.5 7.2L4 20l.9-4.3A8 8 0 1120 12z'],
  [
    'Rede de apoio',
    'Adicionar outro cuidador',
    'M16 18v-1.5a3 3 0 00-3-3H7a3 3 0 00-3 3V18M10 5.5a3 3 0 100 6 3 3 0 000-6M19 18v-1.5a3 3 0 00-2.2-2.9',
  ],
  ['Plano de crise', 'O que fazer se piorar', 'M12 8v5M12 16.5h.01M12 3a9 9 0 100 18 9 9 0 000-18z'],
  ['Check-in agendado', 'Pergunta diária no horário certo', 'M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z'],
  ['Notas privadas', 'Só você lê o que anotar aqui', 'M6 4h9l4 4v12H6zM15 4v4h4M9 12.5h6M9 16h4'],
  ['Comparar semanas', 'O que mudou entre um período e outro', 'M5 19V9M10 19V5M15 19v-7M20 19v-4M4 19h17'],
  ['Lembretes de rotina', 'Sono, remédio, terapia', 'M12 4a6 6 0 016 6v4l2 3H4l2-3v-4a6 6 0 016-6zM9 20h6M12 8v3'],
  ['Exportar dados', 'LGPD: baixe ou apague tudo', 'M12 4v10M8 11l4 4 4-4M5 19h14'],
  [
    'Equipe de cuidado',
    'Terapeuta, escola e família',
    'M12 3a3 3 0 100 6 3 3 0 000-6M5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2M4 11a2.5 2.5 0 100 5M20 11a2.5 2.5 0 110 5',
  ],
];

/* ── Rotina e agenda ────────────────────────────────────────────────────── */

/** [hora, nome, estado, cor] */
/** Sugestão estática de blocos do dia — mesma categoria de conteúdo fixo que
 * PLAYLISTS/TOOL_LIST, sem estado de conclusão (nada rastreia isso ainda). */
/* ── Planos, guia e integrações ─────────────────────────────────────────── */

/** [id, nome, preço, período, benefícios, destaque] */
export const PLANS: [string, string, string, string, string[], boolean][] = [
  [
    'free',
    'Grátis',
    'R$ 0',
    'para sempre',
    ['Leitura de emoção em tempo real', '1 bichinho', 'Ferramentas essenciais'],
    false,
  ],
  [
    'plus',
    'Plus',
    'R$ 14,90',
    'por mês',
    [
      'Todos os 12 bichinhos',
      '22 ferramentas + diário',
      'Spotify e histórico completo',
      '1 cuidador conectado',
    ],
    true,
  ],
  [
    'family',
    'Família',
    'R$ 29,90',
    'por mês',
    [
      'Até 5 perfis',
      'Painel do cuidador completo',
      'Relatório para terapeuta',
      'Plano de crise compartilhado',
    ],
    false,
  ],
];

/** [título, texto, tela, ícone] */
export const GUIDE: [string, string, string, string][] = [
  [
    'Toque no Mellow',
    'Um toque faz carinho. Ele responde com corações e muda de humor por alguns segundos.',
    'home',
    'M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z',
  ],
  [
    'Alimente e brinque',
    'Os três botões abaixo do Mellow dão comida, brincadeira e descanso. Isso sobe o nível dele.',
    'home',
    'M6 3v8a3 3 0 006 0V3M9 11v10M15 3c-1.5 2-1.5 6 0 8v10',
  ],
  [
    'Respiração guiada',
    'Ative na Home. O halo cresce e encolhe no ritmo — siga com a respiração por 5 ciclos.',
    'home',
    'M12 4c3.2 0 5.6 2.4 5.6 5.3 0 4-5.6 10.7-5.6 10.7S6.4 13.3 6.4 9.3C6.4 6.4 8.8 4 12 4z',
  ],
  [
    'Ferramentas',
    '22 exercícios curtos. O app destaca os que combinam com a emoção detectada agora.',
    'tools',
    'M4 8h16v11H4zM8 8V6a2 2 0 012-2h4a2 2 0 012 2v2',
  ],
  [
    'Música por situação',
    'Conecte o Spotify e as playlists tocam sozinhas nas regras que você ligar.',
    'music',
    'M9 18V5l10-2v13M9 18a2.6 2.6 0 11-5.2 0A2.6 2.6 0 019 18z',
  ],
  [
    'Modo cuidador',
    'Em Ajustes › Conexões você entra no painel de quem acompanha alguém.',
    'settings',
    'M16 18v-1.5a3 3 0 00-3-3H7a3 3 0 00-3 3V18M10 5.5a3 3 0 100 6 3 3 0 000-6',
  ],
];

export const COACH: [string, string][] = [
  ['Comece aqui', 'Toque no Mellow para fazer carinho — ele reage ao seu humor.'],
  ['Cuide dele', 'Comida, brincadeira e descanso sobem o nível do seu bichinho.'],
  ['Explore as abas', 'Ferramentas, Música e Cuidado ficam na barra de baixo.'],
];

/** [id, nome, subtítulo, cor, ícone] */
export const INTEGRATIONS: [string, string, string, string, string][] = [
  [
    'spotify',
    'Spotify',
    'Playlists por emoção',
    '#1DB954',
    'M12 3a9 9 0 100 18 9 9 0 000-18zM7.5 9.5c3.4-.9 6.6-.5 9 1M8 13c2.7-.7 5.2-.4 7.2.8M8.5 16.2c2-.5 3.9-.3 5.5.6',
  ],
  ['ytmusic', 'YouTube Music', 'Alternativa de streaming', '#FF4E45', 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8.5l6 3.5-6 3.5z'],
  ['deezer', 'Deezer', 'Alternativa de streaming', '#A238FF', 'M4 16h3v4H4zM9.5 12h3v8h-3zM15 8h3v12h-3zM20.5 4h3v16h-3z'],
  ['health', 'Saúde do telefone', 'Sono e passos', '#FF7675', 'M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z'],
  [
    'watch',
    'Relógio / pulseira',
    'Batimento e movimento',
    '#A29BFE',
    'M12 8v4l3 2M9 2h6l-.5 3.5M9 22h6l-.5-3.5M12 6a6 6 0 100 12 6 6 0 000-12z',
  ],
  ['calendar', 'Agenda', 'Antecipar dias cheios', '#74B9FF', 'M4 7h16v13H4zM8 3v4M16 3v4M4 11h16'],
  ['school', 'Escola', 'Rotina e provas', '#FFD166', 'M3 9l9-5 9 5-9 5zM7 12v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5'],
  ['clinic', 'Clínica', 'Relatório para o terapeuta', '#55EFC4', 'M12 8v8M8 12h8M5 4h14v16H5z'],
  ['lights', 'Luzes inteligentes', 'A casa muda de cor com você', '#FDCB6E', 'M9 21h6M10 17h4a5 5 0 10-4 0zM12 3v1.5'],
  ['speaker', 'Alexa / Google Home', 'Respiração guiada por voz', '#00B894', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['whats', 'WhatsApp', 'Avisar a rede de apoio', '#25D366', 'M20 12a8 8 0 01-11.5 7.2L4 20l.9-4.3A8 8 0 1120 12z'],
  ['focus', 'Não perturbe', 'Silenciar durante o foco', '#B2BEC3', 'M18 8A6 6 0 006 8v4l-2 3h16l-2-3zM3 3l18 18'],
];

/* ── Ajustes ────────────────────────────────────────────────────────────── */

/** [chave, rótulo, descrição] */
export const SETTING_TOGGLES: [string, string, string][] = [
  ['music', 'Músicas de apoio', 'Sugerir faixas a partir da leitura confirmada'],
  ['alerts', 'Sinais persistentes', 'Oferecer apoio após sinais prolongados e confiáveis'],
  ['voice', 'Assistente por voz', 'Perguntar como você está a partir da leitura'],
  ['notif', 'Notificação no celular', 'Lembrete local para fazer uma pausa ou pedir apoio'],
  ['haptics', 'Vibração de apoio', 'Vibrar quando você confirmar que quer ajuda'],
];

export const NO_FACE_MINUTES = [5, 10, 15, 20];

/* ── Onboarding e chat ──────────────────────────────────────────────────── */

export const ONBOARDING: [string, string][] = [
  [
    'Leitura local e sob seu controle',
    'Quando você iniciar uma sessão visível, a câmera analisa expressões no aparelho. Imagens não são enviadas nem armazenadas.',
  ],
  [
    'Ele reage a sinais visuais',
    'Quando uma expressão observada muda de forma consistente, o Mellow reage e pergunta se a leitura combina com o momento.',
  ],
  [
    'Do seu tamanho',
    'Escolha quanta informação quer ver e como prefere a tela. Dá para mudar quando quiser.',
  ],
];

export const QUICK_PROMPTS = [
  'Me ajuda a relaxar agora',
  'O que posso fazer em 5 minutos?',
  'Sugere uma rotina para hoje',
  'Quero entender meu padrão',
];

export const SOS_MESSAGE =
  'Estou aqui com você. Se for urgente, ligue 188 (CVV, 24h). Quer que eu avise alguém da sua rede agora?';

/* ── Ícones da barra de abas ────────────────────────────────────────────── */

export const TAB_ICONS: Record<string, string> = {
  home: 'M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z',
  tools: 'M4 8h16v11H4zM8 8V6a2 2 0 012-2h4a2 2 0 012 2v2M4 13h16',
  dashboard: 'M5 19V11M10 19V5M15 19v-6M20 19v-9',
  settings: 'M5 8h14M5 16h14M9 8V6.2M9 8v1.8M15 16v-1.8M15 16v1.8',
  guide: 'M5 4h6a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2H5zM19 4h-6M19 4v16M19 20h-2.5a2.5 2.5 0 00-2.5 2',
  caretools: 'M4 8h16v11H4zM8 8V6a2 2 0 012-2h4a2 2 0 012 2v2M4 13h16M12 11v4',
  routine: 'M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  agenda: 'M4 7h16v13H4zM8 3v4M16 3v4M4 11h16M9 15h2M14 15h2',
  music: 'M9 18V5l10-2v13M9 18a2.6 2.6 0 11-5.2 0A2.6 2.6 0 019 18zm10-2a2.6 2.6 0 11-5.2 0 2.6 2.6 0 015.2 0z',
  care: 'M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z',
};

/** Ícones avulsos que aparecem em mais de uma tela. */
export const ICONS = {
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  close: 'M7 7l10 10M17 7L7 17',
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
  help: 'M12 17h.01M12 13.5c0-2 2.5-2.2 2.5-4.2A2.5 2.5 0 0012 7a2.5 2.5 0 00-2.5 2.5',
  sliders: 'M5 8h14M5 16h14M9 6.2v3.6M15 14.2v3.6',
  focus: 'M12 12m-3.4 0a3.4 3.4 0 106.8 0a3.4 3.4 0 10-6.8 0',
  heart: 'M12 4c3.2 0 5.6 2.4 5.6 5.3 0 4-5.6 10.7-5.6 10.7S6.4 13.3 6.4 9.3C6.4 6.4 8.8 4 12 4z',
  heartOutline: 'M12 21s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.4-7 10-7 10z',
  // Garfo e faca. O desenho antigo era só um "U" sem dentes, que virava um
  // rabisco no tamanho de 20px usado na Home.
  feed: 'M6.5 3v5M9.5 3v5M12.5 3v5M6.5 8h6v1a3 3 0 01-6 0zM9.5 12v9M17.5 3c-1.6 2-1.6 5.5 0 7.5V21',
  // Bola: círculo + equador + meridianos. Sem o círculo (que dependia da
  // prop `circle` que a Home não passa) sobravam três riscos soltos.
  play:
    'M12 3a9 9 0 100 18 9 9 0 000-18zM3.2 12h17.6M12 3c2.4 2.7 2.4 15.3 0 18M12 3c-2.4 2.7-2.4 15.3 0 18',
  rest: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
  // Corpo, antena e olhos. Antes era só a antena e dois pontos — sem o
  // corpo, os quatro usos (painel, cuidador) mostravam riscos soltos.
  robot: 'M6 8h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zM12 4v4M9.5 13h.01M14.5 13h.01',
  // Nota musical: haste + as duas cabeças. Sem elas sobrava só a bandeira,
  // que no mini-player parecia um traço solto.
  note: 'M9 17.5V5l10-2v12.5M9 17.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM19 15.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  send: 'M12 19V5M6 11l6-6 6 6',
  trash: 'M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12',
  chat: 'M20 12a8 8 0 01-11.5 7.2L4 20l.9-4.3A8 8 0 1120 12z',
  ground: 'M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18',
  book: 'M5 4h6a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2H5zM19 4h-6M19 4v16M19 20h-2.5a2.5 2.5 0 00-2.5 2',
  star: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z',
  alert: 'M12 8v5M12 16.5h.01',
  swap: 'M17 4l3 4-3 4M20 8H9M7 20l-3-4 3-4M4 16h11',
  people:
    'M16 18v-1.5a3 3 0 00-3-3H7a3 3 0 00-3 3V18M10 5.5a3 3 0 100 6 3 3 0 000-6M19 18v-1.5a3 3 0 00-2.2-2.9',
  smile: 'M8.5 14.5c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2M9 9.5h.01M15 9.5h.01',
  spotify:
    'M12 3a9 9 0 100 18 9 9 0 000-18zM7.5 9.5c3.4-.9 6.6-.5 9 1M8 13c2.7-.7 5.2-.4 7.2.8M8.5 16.2c2-.5 3.9-.3 5.5.6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeOff: 'M4 4l16 16M9.9 5.9A9.8 9.8 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3.3 4M6.6 7.9A17 17 0 002.5 12S6 18.5 12 18.5c1.2 0 2.2-.2 3.2-.5M10 10a3 3 0 004.2 4.2',
  shield: 'M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z',
  pause: 'M9 6v12M15 6v12',
  playFill: 'M8 5.5l10 6.5-10 6.5z',
};
