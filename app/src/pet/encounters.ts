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

/**
 * Permissões que o Nearby exige nesta versão do Android. A localização
 * aproximada entra em todas: o Google Play Services recusa startDiscovery()
 * sem ela mesmo no Android 16 — o app não lê localização nenhuma.
 */
function encounterPermissions(): string[] {
  const api = Number(Platform.Version);
  if (api <= 30) return [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  return [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ...(api >= 33 ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] : []),
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];
}

/** Pede as permissões de "dispositivos próximos" da versão do Android. */
export async function requestEncounterPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.requestMultiple(encounterPermissions() as never[]);
  return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

export async function hasEncounterPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const checks = await Promise.all(encounterPermissions().map((p) => PermissionsAndroid.check(p as never)));
  return checks.every(Boolean);
}

/** Texto para a pessoa a partir do status cru do módulo nativo. */
export function describeEncounterStatus(status: string | null): string | null {
  if (!status) return null;
  if (status === 'permission') return 'Falta permissão de dispositivos próximos/localização aproximada. Toque para permitir.';
  if (status === 'searching') return 'Procurando pets por perto enquanto a Home está aberta.';
  if (status === 'found') return 'Achou um pet por perto! Conectando…';
  if (status === 'connected' || status === 'exchanged') return 'Encontro feito.';
  if (status.startsWith('discovery_failed') || status.startsWith('advertise_failed'))
    return `Não deu para procurar (${status.split(':')[1] ?? '?'}). Confira se Bluetooth, Wi-Fi e localização estão ligados.`;
  if (status.startsWith('connect_failed')) return 'Achou um pet, mas a conexão falhou. Aproximem os celulares.';
  return null;
}

export type EncounterHandler = (card: PetCard) => void;

/**
 * Começa a procurar. Devolve a função que para. Silencioso onde o módulo não
 * existe (iOS, Expo Go).
 */
export async function startEncounters(
  me: { petName: string; petType: PetKey; stage: PetStage },
  onEncounter: EncounterHandler,
  onStatus: (status: string) => void = () => undefined
): Promise<() => void> {
  const nearby = MellowNearby;
  if (!nearby) return () => undefined;
  // Sem as permissões o Nearby falha calado; melhor dizer o que falta.
  if (!(await hasEncounterPermissions())) {
    onStatus('permission');
    return () => undefined;
  }
  const own = await token();
  const statusSub = nearby.addListener('onStatus', ({ status }) => onStatus(status));
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
    statusSub.remove();
    onStatus('discovery_failed:start');
    return () => undefined;
  }
  return () => {
    sub.remove();
    statusSub.remove();
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
