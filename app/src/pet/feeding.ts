/**
 * Refeições do pet: no máximo três por dia.
 *
 * Sem limite, "Alimentar" virava o botão de farmar XP — tocar vinte vezes
 * seguidas subia de nível sem nenhum cuidado real. Três refeições é o ritmo de
 * um dia; a quarta tentativa recebe um "ele já está satisfeito" em vez de XP.
 * O contador zera à meia-noite LOCAL.
 */
export const MEALS_PER_DAY = 3;

export type MealRecord = { day: string; count: number };

export function mealsToday(record: MealRecord | null, today: string): number {
  return record && record.day === today ? record.count : 0;
}

export function mealsLeft(record: MealRecord | null, today: string): number {
  return Math.max(0, MEALS_PER_DAY - mealsToday(record, today));
}

/** Registra uma refeição. Devolve null quando o limite do dia já foi atingido. */
export function registerMeal(record: MealRecord | null, today: string): MealRecord | null {
  const count = mealsToday(record, today);
  if (count >= MEALS_PER_DAY) return null;
  return { day: today, count: count + 1 };
}
