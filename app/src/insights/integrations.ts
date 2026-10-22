/**
 * Núcleos puros das integrações: saúde × humor e folgas na agenda. Sem IO — testáveis direto no Node.
 */

// ------------------------------------------------------------ saúde × humor

/** Humor do dia em [-1, 1]: fração agradável menos fração desagradável. */
export function dayMoodScores(events: { emotion: string; day: string }[]): Record<string, number> {
  const POS = new Set(['happy']);
  const NEG = new Set(['sad', 'angry', 'fearful', 'disgusted']);
  const acc: Record<string, { pos: number; neg: number; n: number }> = {};
  for (const e of events) {
    if (e.emotion === 'unknown') continue;
    const a = (acc[e.day] ??= { pos: 0, neg: 0, n: 0 });
    a.n += 1;
    if (POS.has(e.emotion)) a.pos += 1;
    if (NEG.has(e.emotion)) a.neg += 1;
  }
  const out: Record<string, number> = {};
  for (const [day, a] of Object.entries(acc)) if (a.n >= 3) out[day] = (a.pos - a.neg) / a.n;
  return out;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = xs.reduce((a, v) => a + v, 0) / n;
  const my = ys.reduce((a, v) => a + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

export type HealthInsight = { metric: 'sono' | 'passos'; r: number; days: number; text: string };

/** Só fala com pelo menos 7 dias pareados e correlação moderada (|r| ≥ 0,3). */
export function healthInsights(
  days: { day: string; sleepMinutes: number | null; steps: number | null }[],
  mood: Record<string, number>
): HealthInsight[] {
  const out: HealthInsight[] = [];
  const pairs = (pick: (d: (typeof days)[number]) => number | null) =>
    days.filter((d) => pick(d) !== null && mood[d.day] !== undefined).map((d) => [pick(d) as number, mood[d.day]]);
  const sleep = pairs((d) => d.sleepMinutes);
  const steps = pairs((d) => d.steps);
  const rs = pearson(sleep.map((p) => p[0]), sleep.map((p) => p[1]));
  if (rs !== null && sleep.length >= 7 && Math.abs(rs) >= 0.3) {
    out.push({
      metric: 'sono',
      r: rs,
      days: sleep.length,
      text: rs > 0 ? 'Nos dias em que você dorme mais, seu humor tende a ser melhor.' : 'Curioso: dormir mais não tem coincidido com dias melhores.',
    });
  }
  const rp = pearson(steps.map((p) => p[0]), steps.map((p) => p[1]));
  if (rp !== null && steps.length >= 7 && Math.abs(rp) >= 0.3) {
    out.push({
      metric: 'passos',
      r: rp,
      days: steps.length,
      text: rp > 0 ? 'Dias com mais passos costumam vir com humor melhor.' : 'Dias mais agitados (mais passos) têm vindo com humor mais baixo.',
    });
  }
  return out;
}

// ------------------------------------------------------------ agenda

export type Busy = { start: number; end: number };

/**
 * Primeira folga de pelo menos `minMinutes` entre agora e o fim do dia útil,
 * depois de um bloco de compromissos — é ali que uma pausa faz diferença.
 */
export function nextBreak(busy: Busy[], now: number, dayEnd: number, minMinutes = 15): number | null {
  const sorted = busy.filter((b) => b.end > now).sort((a, b) => a.start - b.start);
  let cursor = now;
  for (const b of sorted) {
    if (b.start - cursor >= minMinutes * 60_000 && cursor > now) return cursor;
    cursor = Math.max(cursor, b.end);
  }
  return cursor > now && dayEnd - cursor >= minMinutes * 60_000 ? cursor : null;
}
