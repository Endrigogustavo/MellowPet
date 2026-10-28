import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { apiPost } from '../api/client';
import { supabase } from '../supabase/client';

/**
 * Cuidado como presença: pausa, gestos de carinho, "preciso de você",
 * retorno sobre alertas, push e o copiloto de conversa do cuidador.
 */
const MIGRATION_HINT = 'Este recurso ainda não está ativo no servidor.';

function fail(error: { message?: string; code?: string } | null, action: string): Error {
  const message = error?.message ?? '';
  if (/does not exist|PGRST20[25]|schema cache/i.test(message)) return new Error(`${action}: ${MIGRATION_HINT}`);
  if (/gesture_limit/.test(message)) return new Error('Por hoje já foram vários carinhos. Amanhã tem mais.');
  if (/request_limit/.test(message)) return new Error('Você já pediu contato há pouco. Seu cuidador foi avisado.');
  return new Error(`${action}. Tente de novo.`);
}

// ── pausa ────────────────────────────────────────────────────────────────────
export async function pauseSharing(linkId: string, hours: 0 | 24 | 168): Promise<string | null> {
  const { data, error } = await supabase.rpc('pause_care_sharing', { p_link: linkId, p_hours: hours });
  if (error) throw fail(error, 'Não foi possível pausar o compartilhamento');
  return (data as string | null) ?? null;
}

export function isPaused(link: { paused_until?: string | null }, now = Date.now()): boolean {
  if (!link.paused_until) return false;
  const until = Date.parse(link.paused_until);
  return !Number.isNaN(until) && until > now;
}

// ── retorno sobre alerta ─────────────────────────────────────────────────────
export type AlertFeedback = 'useful' | 'false_alarm' | 'already_knew';
export const FEEDBACK_LABEL: Record<AlertFeedback, string> = {
  useful: 'Foi útil',
  false_alarm: 'Falso alarme',
  already_knew: 'Já sabia',
};

export async function giveAlertFeedback(alertId: string, feedback: AlertFeedback): Promise<void> {
  const { error } = await supabase.rpc('give_alert_feedback', { p_alert: alertId, p_feedback: feedback });
  if (error) throw fail(error, 'Não foi possível registrar o retorno');
}

// ── carinho mediado pelo pet ─────────────────────────────────────────────────
export type GestureKind = 'pensando' | 'abraco' | 'perto';
export const GESTURES: { kind: GestureKind; label: string; delivered: string }[] = [
  { kind: 'pensando', label: 'Pensando em você', delivered: 'está pensando em você' },
  { kind: 'abraco', label: 'Um abraço', delivered: 'mandou um abraço' },
  { kind: 'perto', label: 'Estou por perto', delivered: 'quer que você saiba que está por perto' },
];

export async function sendGesture(link: { id: string; cared_user_id: string | null }, caregiverId: string, kind: GestureKind) {
  if (!link.cared_user_id) return;
  const { error } = await supabase.from('care_gestures').insert({
    caregiver_link_id: link.id,
    caregiver_user_id: caregiverId,
    cared_user_id: link.cared_user_id,
    kind,
  });
  if (error) throw fail(error, 'Não foi possível mandar o carinho');
}

export type Gesture = { id: string; kind: GestureKind; caregiver_link_id: string; created_at: string };

export async function nextUnseenGesture(userId: string): Promise<Gesture | null> {
  const { data, error } = await supabase
    .from('care_gestures')
    .select('id, kind, caregiver_link_id, created_at')
    .eq('cared_user_id', userId)
    .is('seen_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as Gesture | null) ?? null;
}

export async function markGestureSeen(id: string) {
  await supabase.from('care_gestures').update({ seen_at: new Date().toISOString() }).eq('id', id);
}

// ── "preciso de você" ────────────────────────────────────────────────────────
export type Urgency = 'quando_puder' | 'hoje' | 'agora';
export const URGENCY_LABEL: Record<Urgency, string> = {
  quando_puder: 'Quando puder',
  hoje: 'Hoje',
  agora: 'Agora',
};

export async function requestContact(userId: string, urgency: Urgency) {
  const { error } = await supabase.from('care_requests').insert({ cared_user_id: userId, urgency });
  if (error) throw fail(error, 'Não foi possível pedir contato');
}

export type CareRequest = { id: string; cared_user_id: string; urgency: Urgency; created_at: string; acknowledged_at: string | null };

export async function listOpenRequests(caredUserId: string): Promise<CareRequest[]> {
  const { data, error } = await supabase
    .from('care_requests')
    .select('id, cared_user_id, urgency, created_at, acknowledged_at')
    .eq('cared_user_id', caredUserId)
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return [];
  return (data ?? []) as CareRequest[];
}

export async function acknowledgeRequest(id: string, caregiverId: string) {
  const { error } = await supabase
    .from('care_requests')
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: caregiverId })
    .eq('id', id);
  if (error) throw fail(error, 'Não foi possível marcar o pedido');
}

// ── push ─────────────────────────────────────────────────────────────────────
/**
 * Registra o token de push (Expo). Só funciona com o projeto EAS configurado
 * (extra.eas.projectId); sem ele, os avisos locais continuam valendo.
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return false;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token, platform: 'android', updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}

// ── copiloto do cuidador ─────────────────────────────────────────────────────
export type CopilotSummary = {
  period: '24 horas' | '7 dias' | '30 dias';
  events: number;
  score: number | null;
  top_emotion: string | null;
  difficult_share: number;
};

export async function askCopilot(
  message: string,
  history: { role: 'user' | 'bot'; content: string }[],
  summary: CopilotSummary | null
): Promise<string | null> {
  const res = await apiPost<{ response: string | null; provider: string }>('/api/v1/care/chat', {
    message,
    history: history.slice(-8).map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content.slice(0, 2000) })),
    summary,
  });
  return res.response;
}
