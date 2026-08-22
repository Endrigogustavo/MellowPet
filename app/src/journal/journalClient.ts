import { supabase } from '../supabase/client';
import type { JournalEntry } from '../state/AppContext';

type JournalRow = {
  id: string;
  text: string;
  tag: string | null;
  created_at: string;
};

function formatWhen(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const minutesAgo = (Date.now() - date.getTime()) / 60_000;
  if (minutesAgo < 60) return 'agora';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export type StoredJournalEntry = JournalEntry & { entryId: string };

function fromRow(row: JournalRow): StoredJournalEntry {
  return { entryId: row.id, text: row.text, tag: row.tag ?? '', when: formatWhen(row.created_at) };
}

export async function listJournalEntries(userId: string): Promise<StoredJournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, text, tag, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function createJournalEntry(
  userId: string,
  text: string,
  tag: string
): Promise<StoredJournalEntry> {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, text, tag })
    .select('id, text, tag, created_at')
    .single();
  if (error || !data) throw new Error('Não foi possível salvar o registro.');
  return fromRow(data);
}

export async function deleteJournalEntry(_userId: string, entryId: string): Promise<void> {
  await supabase.from('journal_entries').delete().eq('id', entryId);
}
