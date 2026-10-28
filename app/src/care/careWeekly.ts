/**
 * Núcleos puros do painel do cuidador: tendência por humor, resumo semanal
 * em 3 frases e o cuidado com quem cuida (excesso de checagem).
 */
export type DailyValence = { at: string; count: number; pleasant?: number; neutral?: number; difficult?: number };

export type ValenceBar = { at: string; total: number; pleasant: number; neutral: number; difficult: number };

/**
 * Cada dia vira uma barra empilhada (agradável / neutro / difícil) em
 * frações do próprio dia, mais o volume relativo à semana para o tom
 * apagado. Dias de servidores antigos (sem as três contagens) entram como
 * "neutro" — volume conhecido, humor desconhecido.
 */
export function valenceBars(daily: DailyValence[]): ValenceBar[] {
  return daily.map((d) => {
    const pleasant = d.pleasant ?? 0;
    const difficult = d.difficult ?? 0;
    const neutral = d.neutral ?? Math.max(0, d.count - pleasant - difficult);
    const total = pleasant + neutral + difficult;
    return {
      at: d.at,
      total,
      pleasant: total ? pleasant / total : 0,
      neutral: total ? neutral / total : 0,
      difficult: total ? difficult / total : 0,
    };
  });
}

export type WeekInput = {
  name: string;
  events: number;
  daily: DailyValence[];
  openAlerts: number;
};

export type WeekSummary = { sentences: [string, string, string]; suggestion: string };

/** A semana em três frases e uma sugestão de conversa — sem números crus. */
export function weekSummary(w: WeekInput): WeekSummary {
  if (w.events < 3) {
    return {
      sentences: [
        `Quase não houve leituras de ${w.name} nesta semana.`,
        'Pouco dado não quer dizer que algo esteja bem ou mal.',
        w.openAlerts > 0 ? 'Há um alerta aberto esperando você olhar.' : 'Nenhum alerta aberto.',
      ],
      suggestion: `Que tal perguntar como foi a semana de ${w.name}, sem pressa?`,
    };
  }
  const bars = valenceBars(w.daily).filter((b) => b.total > 0);
  const avg = (key: 'pleasant' | 'difficult') => bars.reduce((s, b) => s + b[key], 0) / Math.max(1, bars.length);
  const difficult = avg('difficult');
  const pleasant = avg('pleasant');
  const half = Math.ceil(bars.length / 2);
  const early = bars.slice(0, half).reduce((s, b) => s + b.difficult, 0) / Math.max(1, half);
  const late = bars.slice(half).reduce((s, b) => s + b.difficult, 0) / Math.max(1, bars.length - half);

  const tone =
    difficult >= 0.45
      ? `A semana de ${w.name} teve muitos sinais difíceis.`
      : pleasant >= 0.4
        ? `A semana de ${w.name} teve bastante sinal agradável.`
        : `A semana de ${w.name} foi, em geral, estável.`;
  const trend =
    late - early >= 0.15
      ? 'Os sinais difíceis aumentaram no fim da semana.'
      : early - late >= 0.15
        ? 'Os sinais difíceis diminuíram ao longo da semana.'
        : 'Não houve grande mudança de um dia para o outro.';
  const alerts = w.openAlerts > 0 ? `Há ${w.openAlerts} alerta${w.openAlerts === 1 ? '' : 's'} para acompanhar.` : 'Nenhum alerta aberto.';
  const suggestion =
    difficult >= 0.45 || late - early >= 0.15
      ? `Uma sugestão: "Percebi que a semana pode ter sido pesada. Quer conversar ou prefere só companhia?"`
      : `Uma sugestão: "O que foi a melhor parte da sua semana?"`;
  return { sentences: [tone, trend, alerts], suggestion };
}

/** Quantas aberturas do painel por dia começam a ser checagem demais. */
export const CHECK_LIMIT = 8;

export function checkingNudge(opensToday: number): string | null {
  if (opensToday < CHECK_LIMIT) return null;
  return `Você abriu o painel ${opensToday} vezes hoje. Cuidar cansa — que tal respirar um pouco antes de olhar de novo?`;
}
