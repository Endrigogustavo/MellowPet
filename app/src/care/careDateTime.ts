export type LocalDateTimeResult =
  | { iso: string; timeZone: string; error?: never }
  | { iso?: never; timeZone: string; error: string };

/** Time zone configured on the person's device, used for every care schedule. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'horário local do aparelho';
}

/** Formats a future local date for the plain-text agenda field without UTC ambiguity. */
export function localDateTimeInput(days = 1, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Parses only the displayed local format. Constructing the Date from parts
 * avoids engines interpreting an ISO-like string as UTC.
 */
export function parseDeviceLocalDateTime(value: string): LocalDateTimeResult {
  const timeZone = deviceTimeZone();
  const match = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return { timeZone, error: 'Use o formato AAAA-MM-DD HH:mm.' };

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return { timeZone, error: 'Informe uma data e horário existentes no fuso do aparelho.' };
  }
  return { timeZone, iso: date.toISOString() };
}

export function validateDateRange(startsAt: string, endsAt?: string | null): string | null {
  if (!endsAt) return null;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Não foi possível validar o intervalo do compromisso.';
  return end.getTime() > start.getTime() ? null : 'O término precisa ser posterior ao início.';
}

export function formatInDeviceTimeZone(value: string): string {
  if (Number.isNaN(new Date(value).getTime())) return 'Data não disponível';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: deviceTimeZone(),
    timeZoneName: 'short',
  }).format(new Date(value));
}
