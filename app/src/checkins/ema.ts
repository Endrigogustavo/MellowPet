/**
 * Microcheck-ins em horários aleatórios (EMA — avaliação ecológica momentânea).
 *
 * Perguntar "como você está?" sempre no mesmo horário mede o humor daquele
 * horário. Sortear momentos ao longo do dia dá uma amostra honesta — e cada
 * resposta, comparada com o que a câmera lia, vira rótulo para a calibração e
 * para a auditoria de viés.
 *
 * O dia é dividido em fatias iguais dentro da janela acordada e cada aviso cai
 * num ponto sorteado da sua fatia, longe das bordas: assim dois avisos nunca
 * ficam a menos de `minGapMin` um do outro, e ninguém recebe aviso de madrugada.
 */
export type EmaOptions = {
  perDay: number;
  startHour: number;
  endHour: number;
  minGapMin: number;
};

export const EMA_DEFAULTS: EmaOptions = { perDay: 3, startHour: 9, endHour: 21, minGapMin: 90 };

/** Horários do dia `day` (qualquer instante dele, hora local), em ordem. */
export function pickEmaTimes(day: Date, rng: () => number, opts: EmaOptions = EMA_DEFAULTS): Date[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), opts.startHour, 0, 0, 0).getTime();
  const windowMin = (opts.endHour - opts.startHour) * 60;
  const n = Math.max(0, Math.min(opts.perDay, Math.floor(windowMin / opts.minGapMin)));
  if (n === 0) return [];
  const slot = windowMin / n;
  const margin = Math.min(opts.minGapMin / 2, slot / 2);
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const lo = i * slot + margin;
    const hi = (i + 1) * slot - margin;
    const minute = Math.round(lo + Math.min(0.999999, Math.max(0, rng())) * Math.max(0, hi - lo));
    out.push(new Date(start + minute * 60_000));
  }
  return out;
}

/** Horários de hoje (só os que ainda não passaram) e dos próximos dias. */
export function upcomingEmaTimes(now: Date, days: number, rng: () => number, opts: EmaOptions = EMA_DEFAULTS): Date[] {
  const out: Date[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 12);
    for (const t of pickEmaTimes(day, rng, opts)) {
      // Pelo menos 10 min à frente: aviso "para agora" assusta.
      if (t.getTime() > now.getTime() + 10 * 60_000) out.push(t);
    }
  }
  return out;
}

export const EMA_PROMPTS = [
  'Pausa rapidinha: como você está agora?',
  'Dois toques: qual emoção está mais perto agora?',
  'O Mellow quer saber: como está o seu agora?',
];
