import type { CareNote } from './careUxTypes';

/**
 * Núcleo puro das anotações do cuidador: dia local, agrupamento por dia e
 * normalização das linhas do banco (com ou sem a coluna `note_day`).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** AAAA-MM-DD no fuso do aparelho. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Dia local de um instante ISO; inválido → null. */
export function localDayOf(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : localDayKey(date);
}

/** Converte "AAAA-MM-DD" em Date ao meio-dia local (sem ambiguidade de UTC). */
export function dayToDate(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Hoje", "Ontem" ou "seg., 28/10". */
export function dayLabel(day: string, now = new Date()): string {
  const today = localDayKey(now);
  if (day === today) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDayKey(yesterday)) return 'Ontem';
  const date = dayToDate(day);
  if (!date) return day;
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
  return `${weekday}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** Os últimos `count` dias (hoje primeiro), para escolher o dia da anotação. */
export function recentDayOptions(count = 14, now = new Date()): string[] {
  const days: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    days.push(localDayKey(date));
  }
  return days;
}

export type NotesDay = { day: string; notes: CareNote[] };

/** Agrupa por dia (mais recente primeiro); dentro do dia, a mais nova primeiro. */
export function groupNotesByDay(notes: CareNote[]): NotesDay[] {
  const byDay = new Map<string, CareNote[]>();
  for (const note of notes) {
    const list = byDay.get(note.note_day) ?? [];
    list.push(note);
    byDay.set(note.note_day, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, list]) => ({
      day,
      notes: [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)),
    }));
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * Linha do banco → CareNote. Servidores sem a migration de UX não têm
 * `note_day` (usa o dia local de `created_at`) nem `caregiver_link_id`/
 * `author_id` (usa o vínculo atual e `caregiver_user_id`).
 */
export function normalizeNoteRow(row: Record<string, unknown>, fallbackLinkId: string): CareNote | null {
  const id = str(row.id);
  const body = typeof row.body === 'string' ? row.body : null;
  const createdAt = str(row.created_at);
  if (!id || body === null || !createdAt) return null;
  const noteDay = str(row.note_day)?.slice(0, 10) ?? localDayOf(createdAt);
  if (!noteDay) return null;
  return {
    id,
    body,
    created_at: createdAt,
    updated_at: str(row.updated_at),
    note_day: noteDay,
    cared_user_id: str(row.cared_user_id) ?? '',
    caregiver_link_id: str(row.caregiver_link_id) ?? fallbackLinkId,
    author_id: str(row.author_id) ?? str(row.caregiver_user_id) ?? '',
  };
}

/** Editada depois de criada (mais de 1 min de diferença)? */
export function wasEdited(note: Pick<CareNote, 'created_at' | 'updated_at'>): boolean {
  if (!note.updated_at) return false;
  const created = Date.parse(note.created_at);
  const updated = Date.parse(note.updated_at);
  return !Number.isNaN(created) && !Number.isNaN(updated) && updated - created > 60_000;
}
