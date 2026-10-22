import * as SecureStore from 'expo-secure-store';

import { LIGHT_FOR } from '../insights/integrations';

/**
 * Luzes da casa pelo Home Assistant (que também controla Philips Hue).
 *
 * A pessoa informa o endereço do HA, um token de acesso de longa duração e a
 * luz (entity_id). O token fica no SecureStore e as chamadas vão direto do
 * celular para a casa — nada passa pelo servidor do MellowPet.
 */
export type LightsConfig = { url: string; token: string; entity: string; enabled: boolean };

const KEY = 'mellowpet.lights.v1';

export async function loadLights(): Promise<LightsConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const c = raw ? (JSON.parse(raw) as Partial<LightsConfig>) : null;
    if (!c?.url || !c.token || !c.entity) return null;
    return { url: c.url, token: c.token, entity: c.entity, enabled: c.enabled === true };
  } catch {
    return null;
  }
}

export async function saveLights(c: LightsConfig | null): Promise<void> {
  if (!c) await SecureStore.deleteItemAsync(KEY);
  else await SecureStore.setItemAsync(KEY, JSON.stringify(c));
}

/** Endereço válido: http(s), sem barra final. Recusa o resto. */
export function normalizeUrl(raw: string): string | null {
  const url = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+(:\d+)?(\/[^\s]*)?$/i.test(url) ? url : null;
}

export async function setLightForEmotion(c: LightsConfig, emotion: string): Promise<void> {
  const look = LIGHT_FOR[emotion] ?? LIGHT_FOR.neutral;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${c.url}/api/services/light/turn_on`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: c.entity, rgb_color: look.rgb, brightness_pct: look.brightness, transition: 4 }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Home Assistant respondeu ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}
