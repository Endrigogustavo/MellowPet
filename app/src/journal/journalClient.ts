import { apiDelete, apiGet, apiPost } from '../api/client';
import type { JournalEntry } from '../state/AppContext';

type JournalApiEntry = {
  entry_id: string;
  user_id: string;
  text: string;
  tag: string | null;
  created_at: string;
};

function formatWhen(createdAt: string): string {
  const date = new Date(createdAt.endsWith('Z') ? createdAt : `${createdAt}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const minutesAgo = (Date.now() - date.getTime()) / 60_000;
  if (minutesAgo < 60) return 'agora';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export type StoredJournalEntry = JournalEntry & { entryId: string };

export async function listJournalEntries(userId: string): Promise<StoredJournalEntry[]> {
  const data = await apiGet<{ entries: JournalApiEntry[] }>('/api/v1/journal/', { user_id: userId });
  return data.entries.map((e) => ({
    entryId: e.entry_id,
    text: e.text,
    tag: e.tag ?? '',
    when: formatWhen(e.created_at),
  }));
}

export async function createJournalEntry(
  userId: string,
  text: string,
  tag: string
): Promise<StoredJournalEntry> {
  const entry = await apiPost<JournalApiEntry>('/api/v1/journal/', { user_id: userId, text, tag });
  return { entryId: entry.entry_id, text: entry.text, tag: entry.tag ?? '', when: 'agora' };
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  await apiDelete(`/api/v1/journal/${entryId}`, { user_id: userId });
}
