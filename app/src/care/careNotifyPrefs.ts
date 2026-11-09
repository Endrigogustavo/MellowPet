/**
 * Núcleo puro das preferências de notificação: horários "HH:MM" e o texto do
 * silêncio noturno. Pedidos "agora" furam o silêncio (decisão do plano §2).
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** "22:00:00" (Postgres time) ou "22:00" → "22:00"; inválido → null. */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** Soma minutos dando a volta no relógio. */
export function shiftTime(hhmm: string, deltaMinutes: number): string {
  const base = normalizeTime(hhmm) ?? '00:00';
  const [h, m] = base.split(':').map(Number);
  const total = (((h * 60 + m + deltaMinutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function quietSummary(start: string | null, end: string | null): string {
  if (!start || !end) return 'Sem silêncio noturno: os avisos chegam a qualquer hora.';
  if (start === end) return 'Início e fim iguais: escolha horários diferentes para o silêncio valer.';
  return `Silêncio das ${start} às ${end}. Pedidos de contato marcados como “agora” tocam mesmo assim.`;
}

/** O horário `hhmm` cai dentro do silêncio (que pode atravessar a meia-noite)? */
export function inQuietHours(hhmm: string, start: string | null, end: string | null): boolean {
  if (!start || !end || start === end) return false;
  return start < end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
}
