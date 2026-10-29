import { supabase } from '../supabase/client';
import { localDay } from './growth';

/**
 * Registra que hoje houve cuidado. Idempotente: o mesmo dia só conta uma vez
 * (chave primária user_id + day), então pode ser chamado a cada toque.
 * Erros são silenciosos — perder a marcação de um dia não deve atrapalhar o
 * gesto de cuidado que a disparou.
 */
const marked = new Set<string>();

export async function markCareDay(userId: string): Promise<boolean> {
  const day = localDay();
  const key = `${userId}:${day}`;
  if (marked.has(key)) return false;
  const { data, error } = await supabase
    .from('care_days')
    .upsert({ user_id: userId, day }, { onConflict: 'user_id,day', ignoreDuplicates: true })
    .select('day');
  if (error) return false;
  marked.add(key);
  return Array.isArray(data) ? data.length > 0 : true;
}

/** Quantos dias distintos de cuidado a pessoa já teve. 0 se a tabela não existir. */
export async function fetchCareDayCount(userId: string): Promise<number> {
  const { data, count, error } = await supabase
    .from('care_days')
    .select('day', { count: 'exact' })
    .eq('user_id', userId);
  if (error) return 0;
  for (const row of data ?? []) {
    if (row && typeof row.day === 'string') {
      marked.add(`${userId}:${row.day}`);
    }
  }
  return count ?? (data?.length ?? 0);
}
