import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase/client';

export type EmergencyContact = { name: string; contact: string };

export type RemoteSettings = {
  pet_type: string;
  pet_name: string;
  emergency_contacts: EmergencyContact[];
  music_enabled: boolean;
  alerts_enabled: boolean;
  no_face_alert_minutes: number;
  preferred_music_mood: string;
};

const DEFAULTS: RemoteSettings = {
  pet_type: 'seal',
  pet_name: 'Mellow',
  emergency_contacts: [],
  music_enabled: true,
  alerts_enabled: true,
  no_face_alert_minutes: 10,
  preferred_music_mood: 'calm',
};

const contactsKey = (userId: string) => `mellowpet.contacts.v1.${encodeURIComponent(userId).slice(0, 120)}`;

/** Cópia local dos contatos de emergência: o SOS precisa deles SEM rede. */
export async function cachedContacts(userId: string): Promise<EmergencyContact[]> {
  try {
    const list = JSON.parse((await SecureStore.getItemAsync(contactsKey(userId))) ?? '[]') as unknown;
    return Array.isArray(list)
      ? list.filter((c): c is EmergencyContact => typeof c?.name === 'string' && typeof c?.contact === 'string')
      : [];
  } catch {
    return [];
  }
}

function cacheContacts(userId: string, contacts: EmergencyContact[]) {
  SecureStore.setItemAsync(contactsKey(userId), JSON.stringify(contacts.slice(0, 10))).catch(() => undefined);
}

export async function fetchSettings(userId: string): Promise<RemoteSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
  // Sem linha ainda (PGRST116) = conta nova, padrões. Qualquer outro erro
  // (rede!) precisa aparecer: antes virava "padrões" e o próximo salvamento
  // apagava contatos de emergência e o nome do pet.
  if (error && error.code !== 'PGRST116') throw new Error('Não foi possível carregar seus ajustes. Verifique a conexão.');
  if (!data) return DEFAULTS;
  if (Array.isArray(data.emergency_contacts)) cacheContacts(userId, data.emergency_contacts);
  return {
    pet_type: data.pet_type ?? DEFAULTS.pet_type,
    pet_name: data.pet_name ?? DEFAULTS.pet_name,
    emergency_contacts: Array.isArray(data.emergency_contacts) ? data.emergency_contacts : [],
    music_enabled: data.music_enabled ?? DEFAULTS.music_enabled,
    alerts_enabled: data.alerts_enabled ?? DEFAULTS.alerts_enabled,
    no_face_alert_minutes: data.no_face_alert_minutes ?? DEFAULTS.no_face_alert_minutes,
    preferred_music_mood: data.preferred_music_mood ?? DEFAULTS.preferred_music_mood,
  };
}

export async function saveSettings(
  userId: string,
  patch: Partial<RemoteSettings>
): Promise<RemoteSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error || !data) throw new Error('Não foi possível salvar os ajustes.');
  if (Array.isArray(data.emergency_contacts)) cacheContacts(userId, data.emergency_contacts);
  return {
    pet_type: data.pet_type,
    pet_name: data.pet_name,
    emergency_contacts: Array.isArray(data.emergency_contacts) ? data.emergency_contacts : [],
    music_enabled: data.music_enabled,
    alerts_enabled: data.alerts_enabled,
    no_face_alert_minutes: data.no_face_alert_minutes,
    preferred_music_mood: data.preferred_music_mood,
  };
}
