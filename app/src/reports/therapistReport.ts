/**
 * Relatório para levar à terapia: o que a PESSOA registrou nos últimos dias,
 * em números — não é diagnóstico nem laudo, e o texto diz isso.
 *
 * As anotações livres só entram se ela marcar; tudo é escapado antes de virar
 * HTML (uma anotação com "<script>" não pode virar código no PDF).
 */
export type ReportCheckin = {
  emotion: string;
  tags: string[];
  sleepQuality: number | null;
  note: string;
  createdAt: string;
};

export type ReportInput = {
  name: string;
  days: number;
  checkins: ReportCheckin[];
  includeNotes: boolean;
  generatedAt: Date;
};

const LABEL: Record<string, string> = {
  happy: 'Alegria',
  neutral: 'Neutro',
  sad: 'Tristeza',
  angry: 'Raiva',
  fearful: 'Medo/ansiedade',
  surprised: 'Surpresa',
  disgusted: 'Nojo/aversão',
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '—');

export function summarize(checkins: ReportCheckin[]) {
  const total = checkins.length;
  const byEmotion = new Map<string, number>();
  const byTag = new Map<string, number>();
  const sleeps: number[] = [];
  for (const c of checkins) {
    byEmotion.set(c.emotion, (byEmotion.get(c.emotion) ?? 0) + 1);
    for (const t of c.tags) byTag.set(t, (byTag.get(t) ?? 0) + 1);
    if (c.sleepQuality !== null) sleeps.push(c.sleepQuality);
  }
  const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total,
    emotions: sort(byEmotion),
    tags: sort(byTag).slice(0, 8),
    sleepAvg: sleeps.length ? sleeps.reduce((a, v) => a + v, 0) / sleeps.length : null,
    activeDays: new Set(checkins.map((c) => c.createdAt.slice(0, 10))).size,
  };
}

export function reportHtml(input: ReportInput): string {
  const s = summarize(input.checkins);
  const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const rows = s.emotions
    .map(([e, n]) => `<tr><td>${escapeHtml(LABEL[e] ?? e)}</td><td>${n}</td><td>${pct(n, s.total)}</td></tr>`)
    .join('');
  const tags = s.tags.map(([t, n]) => `<li>${escapeHtml(t)} — ${n}×</li>`).join('');
  const notes = input.includeNotes
    ? input.checkins
        .filter((c) => c.note.trim())
        .map((c) => `<li><b>${date(c.createdAt)} · ${escapeHtml(LABEL[c.emotion] ?? c.emotion)}:</b> ${escapeHtml(c.note)}</li>`)
        .join('')
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;color:#241730;padding:28px;font-size:13px}
h1{color:#5B4BDB;font-size:22px;margin:0}h2{font-size:15px;margin-top:22px;color:#5B4BDB}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}
.muted{color:#777;font-size:11px}
</style></head><body>
<h1>Relatório MellowPet</h1>
<p class="muted">${escapeHtml(input.name)} · últimos ${input.days} dias · gerado em ${input.generatedAt.toLocaleDateString('pt-BR')}</p>
<p>${s.total} check-ins em ${s.activeDays} dias diferentes.${
    s.sleepAvg !== null ? ` Qualidade de sono média: ${s.sleepAvg.toFixed(1)} de 5.` : ''
  }</p>
<h2>Como a pessoa disse que estava</h2>
<table><tr><th>Emoção</th><th>Vezes</th><th>%</th></tr>${rows || '<tr><td colspan="3">Sem check-ins no período.</td></tr>'}</table>
${tags ? `<h2>Contextos mais marcados</h2><ul>${tags}</ul>` : ''}
${notes ? `<h2>Anotações (compartilhadas pela pessoa)</h2><ul>${notes}</ul>` : ''}
<p class="muted" style="margin-top:28px">Autorrelato registrado no app MellowPet. Não é diagnóstico nem avaliação clínica — serve como apoio à conversa com o profissional.</p>
</body></html>`;
}
