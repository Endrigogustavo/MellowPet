import * as SecureStore from 'expo-secure-store';

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

/** Encontros com outros pets: opt-in deste aparelho, desligado por padrão. */
const ENCOUNTERS_KEY = 'mellowpet.encounters.v1';

export async function loadEncountersEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENCOUNTERS_KEY)) === 'on';
}

export async function saveEncountersEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(ENCOUNTERS_KEY, enabled ? 'on' : 'off');
}
