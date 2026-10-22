import * as SecureStore from 'expo-secure-store';

import { parseHabits, type Habits } from '../pet/habits';
import type { Density } from './AppContext';

/**
 * Preferências de exibição, guardadas no aparelho.
 *
 * Ficam locais e não no `user_settings` do Supabase de propósito: são sobre
 * como ESTE aparelho mostra o app, não sobre a conta. Alguém pode querer o
 * modo simples no celular e o completo no tablet.
 */
const DENSITY_KEY = 'mellowpet.density.v1';

export async function loadDensity(): Promise<Density | null> {
  const value = await SecureStore.getItemAsync(DENSITY_KEY);
  return value === 'simples' || value === 'completo' ? value : null;
}

export async function saveDensity(density: Density): Promise<void> {
  await SecureStore.setItemAsync(DENSITY_KEY, density);
}

/** Refeições de hoje, por conta. Local: é ritmo de uso, não dado da conta. */
const mealsKey = (userId: string) => `mellowpet.meals.v1.${encodeURIComponent(userId).slice(0, 120)}`;

export async function loadMeals(userId: string): Promise<{ day: string; count: number } | null> {
  try {
    const raw = await SecureStore.getItemAsync(mealsKey(userId));
    const parsed = raw ? (JSON.parse(raw) as { day?: unknown; count?: unknown }) : null;
    if (parsed && typeof parsed.day === 'string' && typeof parsed.count === 'number') {
      return { day: parsed.day, count: parsed.count };
    }
  } catch {
    // registro corrompido vale como dia novo
  }
  return null;
}

export async function saveMeals(userId: string, record: { day: string; count: number }): Promise<void> {
  await SecureStore.setItemAsync(mealsKey(userId), JSON.stringify(record));
}

/** Encontros com outros pets: opt-in deste aparelho, desligado por padrão. */
const ENCOUNTERS_KEY = 'mellowpet.encounters.v1';

export async function loadEncountersEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENCOUNTERS_KEY)) === 'on';
}

export async function saveEncountersEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(ENCOUNTERS_KEY, enabled ? 'on' : 'off');
}

/** Microcheck-ins em horários sorteados: opt-in deste aparelho. */
const EMA_KEY = 'mellowpet.ema.v1';

export async function loadEmaEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(EMA_KEY)) === 'on';
}

export async function saveEmaEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(EMA_KEY, enabled ? 'on' : 'off');
}

/** Diário de hábitos do pet (personalidade, acessórios, rituais), por conta. */
const habitsKey = (userId: string) => `mellowpet.habits.v1.${encodeURIComponent(userId).slice(0, 120)}`;

export async function loadHabits(userId: string): Promise<Habits> {
  try {
    return parseHabits(await SecureStore.getItemAsync(habitsKey(userId)));
  } catch {
    return parseHabits(null);
  }
}

export async function saveHabits(userId: string, habits: Habits): Promise<void> {
  await SecureStore.setItemAsync(habitsKey(userId), JSON.stringify(habits));
}
