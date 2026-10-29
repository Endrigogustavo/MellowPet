import * as SecureStore from 'expo-secure-store';

import { parseNotes } from '../chat/memory';
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

/**
 * Memória do Mellow: consentimento + notas que a pessoa pediu para lembrar.
 * Fica no aparelho; só segue com a mensagem quando ligada.
 */
const memoryKey = (userId: string) => `mellowpet.memory.v1.${encodeURIComponent(userId).slice(0, 120)}`;

export async function loadMemory(userId: string): Promise<{ enabled: boolean; notes: string[] }> {
  try {
    const raw = await SecureStore.getItemAsync(memoryKey(userId));
    const parsed = raw ? (JSON.parse(raw) as { enabled?: unknown; notes?: unknown }) : null;
    return {
      enabled: parsed?.enabled === true,
      notes: parseNotes(JSON.stringify(parsed?.notes ?? [])),
    };
  } catch {
    return { enabled: false, notes: [] };
  }
}

export async function saveMemory(userId: string, memory: { enabled: boolean; notes: string[] }): Promise<void> {
  await SecureStore.setItemAsync(memoryKey(userId), JSON.stringify(memory));
}

/** "O Mellow fala": lê as respostas do chat em voz alta. Deste aparelho. */
const SPEAK_KEY = 'mellowpet.speak.v1';

export async function loadSpeak(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SPEAK_KEY)) === 'on';
}

export async function saveSpeak(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SPEAK_KEY, enabled ? 'on' : 'off');
}

/** Cápsula do tempo (texto e se já foi selada), guardada no aparelho por conta. */
const capsuleKey = (userId: string) => `mellowpet.capsule.v1.${encodeURIComponent(userId).slice(0, 120)}`;

export async function loadCapsule(userId: string): Promise<{ text: string; saved: boolean }> {
  try {
    const raw = await SecureStore.getItemAsync(capsuleKey(userId));
    const parsed = raw ? (JSON.parse(raw) as { text?: unknown; saved?: unknown }) : null;
    if (parsed && typeof parsed.text === 'string') {
      return { text: parsed.text.slice(0, 2000), saved: parsed.saved === true };
    }
  } catch {
    // registro corrompido volta vazio
  }
  return { text: '', saved: false };
}

export async function saveCapsule(userId: string, capsule: { text: string; saved: boolean }): Promise<void> {
  await SecureStore.setItemAsync(
    capsuleKey(userId),
    JSON.stringify({ text: capsule.text.slice(0, 2000), saved: capsule.saved })
  );
}
