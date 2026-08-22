import { supabase } from '../supabase/client';

export type RoutineItem = {
  id: string;
  time: string; // 'HH:MM'
  name: string;
  notify: boolean;
};

export async function listRoutineItems(userId: string): Promise<RoutineItem[]> {
  const { data, error } = await supabase
    .from('routine_items')
    .select('id, time, name, notify')
    .eq('user_id', userId)
    .order('time', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function createRoutineItem(
  userId: string,
  time: string,
  name: string,
  notify: boolean
): Promise<RoutineItem> {
  const { data, error } = await supabase
    .from('routine_items')
    .insert({ user_id: userId, time, name, notify })
    .select('id, time, name, notify')
    .single();
  if (error || !data) throw new Error('Não foi possível salvar o item da rotina.');
  return data;
}

export async function updateRoutineItem(
  id: string,
  patch: Partial<Pick<RoutineItem, 'time' | 'name' | 'notify'>>
): Promise<RoutineItem> {
  const { data, error } = await supabase
    .from('routine_items')
    .update(patch)
    .eq('id', id)
    .select('id, time, name, notify')
    .single();
  if (error || !data) throw new Error('Não foi possível atualizar o item da rotina.');
  return data;
}

export async function deleteRoutineItem(id: string): Promise<void> {
  await supabase.from('routine_items').delete().eq('id', id);
}
