import { PermissionsAndroid, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

import MellowNearby, { isMellowNearbyAvailable } from '../../modules/mellow-nearby';
import type { PetKey } from '../data/pets';
import { supabase } from '../supabase/client';
import { acceptEncounter, buildCard, parseCard, type PetCard } from './encounterPayload';
import type { PetStage } from './growth';

/**
 * Encontros entre pets por proximidade (Nearby Connections).
 *
 * Só roda com o app aberto e com o opt-in ligado. O aparelho anuncia o cartão
 * do pet e procura outros por perto; quando acha, os dois trocam cartões e o
 * pet do outro "visita" o seu na tela.
 */

export { isMellowNearbyAvailable };

/** Token da sessão: muda a cada vez que o app abre, então não rastreia ninguém. */
let sessionToken: string | null = null;
let seen = new Map<string, number>();

async function token(): Promise<string> {
  if (!sessionToken) {
    const bytes = await Crypto.getRandomBytesAsync(12);
    sessionToken = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sessionToken;
}

/** Pede as permissões de "dispositivos próximos" da versão do Android. */
export async function requestEncounterPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const api = Number(Platform.Version);
  const wanted: string[] =
    api >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ...(api >= 33 ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] : []),
          ...(api <= 32 ? [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] : []),
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted as never[]);
  return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

export type EncounterHandler = (card: PetCard) => void;

/**
 * Começa a procurar. Devolve a função que para. Silencioso onde o módulo não
 * existe (iOS, Expo Go).
 */
export async function startEncounters(
  me: { petName: string; petType: PetKey; stage: PetStage },
  onEncounter: EncounterHandler
): Promise<() => void> {
  const nearby = MellowNearby;
  if (!nearby) return () => undefined;
  const own = await token();
  const sub = nearby.addListener('onEncounter', ({ payload }) => {
    const card = parseCard(payload);
    if (!card) return;
    const decision = acceptEncounter(card, own, seen, Date.now());
    seen = decision.seen;
    if (decision.accepted) onEncounter(card);
  });
  try {
    nearby.start(buildCard(me.petName, me.petType, me.stage, own));
  } catch {
    sub.remove();
    return () => undefined;
  }
  return () => {
    sub.remove();
    try {
      nearby.stop();
    } catch {
      // já parado
    }
  };
}

export type Friend = {
  id: string;
  petName: string;
  petType: PetKey;
  stage: PetStage;
  metAt: string;
};

export async function recordEncounter(userId: string, card: PetCard): Promise<void> {
  await supabase.from('pet_encounters').insert({
    user_id: userId,
    other_pet_name: card.petName,
    other_pet_type: card.petType,
    other_stage: card.stage,
  });
}

export async function listFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('pet_encounters')
    .select('id, other_pet_name, other_pet_type, other_stage, met_at')
    .eq('user_id', userId)
    .order('met_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`Não foi possível carregar os amigos do Mellow: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    petName: r.other_pet_name as string,
    petType: r.other_pet_type as PetKey,
    stage: r.other_stage as PetStage,
    metAt: r.met_at as string,
  }));
}
