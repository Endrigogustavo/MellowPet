import type { PetKey } from '../data/pets';
import type { PetStage } from './growth';

/**
 * O "cartão" que um pet mostra ao outro quando as pessoas se encontram.
 *
 * É TUDO o que atravessa entre os aparelhos: nome, espécie e estágio do pet,
 * mais um token aleatório da sessão para não repetir o mesmo encontro. Nenhum
 * id de conta, nenhuma emoção, nenhum dado de bem-estar — o encontro é social
 * sem expor ninguém.
 *
 * Tudo que chega é tratado como entrada hostil: qualquer app com o mesmo
 * serviceId poderia mandar bytes, então valida forma, tamanho e valores.
 */

export type PetCard = {
  v: 1;
  petName: string;
  petType: PetKey;
  stage: PetStage;
  token: string;
};

// Lista local, e não PET_TYPES, para este módulo rodar no teste do Node sem
// puxar data/pets. O `Record` obriga a cobrir exatamente as chaves de PetKey:
// espécie nova sem entrada aqui não compila.
const PET_KEY_SET: Record<PetKey, true> = {
  seal: true, dog: true, cat: true, bunny: true, bear: true, fox: true,
  panda: true, owl: true, penguin: true, hamster: true, capybara: true, unicorn: true,
};
const PET_KEYS = new Set<string>(Object.keys(PET_KEY_SET));
const STAGES = new Set<string>(['filhote', 'jovem', 'adulto']);
const NAME_MAX = 24;

/** Um mesmo pet não "visita" de novo antes disto. */
export const ENCOUNTER_COOLDOWN_MS = 30 * 60 * 1000;

export function buildCard(petName: string, petType: PetKey, stage: PetStage, token: string): string {
  const card: PetCard = { v: 1, petName: cleanName(petName), petType, stage, token };
  return JSON.stringify(card);
}

function cleanName(name: string): string {
  // Sem caracteres de controle, de direção (U+202E inverte o texto e permite
  // disfarçar nomes) nem invisíveis; corta por caractere, não por unidade
  // UTF-16 — senão um emoji partido ao meio vira texto malformado.
  const stripped = name.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/g, '').trim();
  const cleaned = Array.from(stripped).slice(0, NAME_MAX).join('').trim();
  return cleaned || 'Amigo';
}

export function parseCard(raw: string): PetCard | null {
  if (typeof raw !== 'string' || raw.length > 512) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const c = data as Record<string, unknown>;
  if (c.v !== 1) return null;
  if (typeof c.petName !== 'string' || typeof c.petType !== 'string' || typeof c.stage !== 'string') return null;
  if (typeof c.token !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(c.token)) return null;
  if (!PET_KEYS.has(c.petType) || !STAGES.has(c.stage)) return null;
  return {
    v: 1,
    petName: cleanName(c.petName),
    petType: c.petType as PetKey,
    stage: c.stage as PetStage,
    token: c.token,
  };
}

/** Decide se o encontro conta, e devolve o mapa atualizado de quando cada token foi visto. */
export function acceptEncounter(
  card: PetCard,
  ownToken: string,
  seen: Map<string, number>,
  now: number
): { accepted: boolean; seen: Map<string, number> } {
  if (card.token === ownToken) return { accepted: false, seen };
  const last = seen.get(card.token);
  if (last !== undefined && now - last < ENCOUNTER_COOLDOWN_MS) return { accepted: false, seen };
  const next = new Map(seen);
  next.set(card.token, now);
  return { accepted: true, seen: next };
}
