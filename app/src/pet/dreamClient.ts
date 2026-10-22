import * as SecureStore from 'expo-secure-store';

import { apiPost } from '../api/client';
import { SERVER_CONFIGURED } from '../chat/chatClient';
import { listDetectedEvents } from '../checkins/checkinClient';
import { localDream, type DreamInput } from './dream';
import { listFriends } from './encounters';
import type { Habits } from './habits';

/**
 * O sonho da manhã: junta os agregados de ontem, pede a versão da IA ao
 * servidor e, sem servidor ou sem provedor, usa a versão local. Guarda o
 * sonho do dia no aparelho — reabrir o app não gera outro (nem gasta IA).
 */
const cacheKey = (userId: string) => `mellowpet.dream.v1.${encodeURIComponent(userId).slice(0, 120)}`;

const NAME_OK = /^[0-9A-Za-zÀ-ÖØ-öø-ÿ' -]{1,24}$/;
const KNOWN = new Set(['happy', 'sad', 'angry', 'neutral', 'surprised', 'disgusted', 'fearful']);

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function yesterdayInput(userId: string, petName: string, habits: Habits, now: Date): Promise<DreamInput> {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 3600 * 1000;
  const yesterday = dayKey(new Date(yesterdayStart));

  const [events, friends] = await Promise.all([
    listDetectedEvents(userId, yesterdayStart).catch(() => []),
    listFriends(userId).catch(() => []),
  ]);
  const counts = new Map<string, number>();
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    if (t < todayStart && KNOWN.has(e.emotion)) counts.set(e.emotion, (counts.get(e.emotion) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const daily = habits.daily[yesterday] ?? {};
  const metYesterday = friends
    .filter((f) => {
      const t = new Date(f.metAt).getTime();
      return t >= yesterdayStart && t < todayStart;
    })
    .map((f) => f.petName)
    .filter((n) => NAME_OK.test(n));

  return {
    petName,
    dominant,
    fed: daily.feed ?? 0,
    played: daily.play ?? 0,
    breaths: daily.breath ?? 0,
    friends: [...new Set(metYesterday)].slice(0, 3),
    day: dayKey(now),
  };
}

export async function morningDream(userId: string, petName: string, habits: Habits, now = new Date()): Promise<string> {
  const today = dayKey(now);
  try {
    const cached = JSON.parse((await SecureStore.getItemAsync(cacheKey(userId))) ?? 'null') as {
      day: string;
      text: string;
    } | null;
    if (cached?.day === today && cached.text) return cached.text;
  } catch {
    // cache corrompido: gera de novo
  }

  const input = await yesterdayInput(userId, petName, habits, now);
  let text: string | null = null;
  if (SERVER_CONFIGURED && NAME_OK.test(petName)) {
    try {
      const res = await apiPost<{ dream: string | null; provider: string }>('/api/v1/pet/dream', {
        pet_name: input.petName,
        dominant: input.dominant,
        fed: Math.min(input.fed, 50),
        played: Math.min(input.played, 200),
        breaths: Math.min(input.breaths, 50),
        friends: input.friends,
      });
      if (res.dream && res.provider !== 'fallback') text = res.dream.slice(0, 600);
    } catch {
      // servidor fora: versão local abaixo
    }
  }
  text ??= localDream(input);
  SecureStore.setItemAsync(cacheKey(userId), JSON.stringify({ day: today, text })).catch(() => undefined);
  return text;
}
