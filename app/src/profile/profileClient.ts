import { supabase } from '../supabase/client';

export type ProfileStats = { xp: number; fed: number; played: number };

/** Nível é sempre derivado de xp, nunca um valor próprio — evita o estado
 * desconectado que existia antes (um "Nível 4" fixo que nunca mudava). */
export function levelFromXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const { data, error } = await supabase.from('profiles').select('xp, fed, played').eq('id', userId).single();
  if (error || !data) return { xp: 0, fed: 0, played: 0 };
  return { xp: data.xp ?? 0, fed: data.fed ?? 0, played: data.played ?? 0 };
}

let queue: Promise<unknown> = Promise.resolve();

/** Incrementa (ou decrementa) os contadores do usuário autenticado de forma
 * atômica no banco — nunca lê-modifica-escreve no cliente. As chamadas saem
 * em fila para que duas ações rápidas ("Brincar" + "Alimentar") não corram em
 * paralelo e sobrescrevam o estado com uma resposta fora de ordem. */
export function bumpProfileStats(delta: {
  fed?: number;
  played?: number;
  xp?: number;
}): Promise<ProfileStats | null> {
  const run = async (): Promise<ProfileStats | null> => {
    const { data, error } = await supabase.rpc('bump_profile', {
      fed_delta: delta.fed ?? 0,
      played_delta: delta.played ?? 0,
      xp_delta: delta.xp ?? 0,
    });
    if (error || !data) return null;
    return { xp: data.xp ?? 0, fed: data.fed ?? 0, played: data.played ?? 0 };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
