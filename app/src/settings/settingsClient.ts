import { apiGet, apiPut } from '../api/client';

export type RemoteSettings = {
  user_id: string;
  pet_type: string;
  pet_name: string;
  emergency_contacts: string[];
  music_enabled: boolean;
  alerts_enabled: boolean;
  no_face_alert_minutes: number;
  preferred_music_mood: string;
};

export function fetchSettings(userId: string): Promise<RemoteSettings> {
  return apiGet<RemoteSettings>('/api/v1/settings/', { user_id: userId });
}

export function saveSettings(
  userId: string,
  patch: Partial<Omit<RemoteSettings, 'user_id'>>
): Promise<RemoteSettings> {
  return apiPut<RemoteSettings>('/api/v1/settings/', { user_id: userId, ...patch });
}
