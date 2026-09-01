import * as Crypto from 'expo-crypto';

import { supabase } from '../supabase/client';
import { toCareClientError } from './careErrors';
import { isCareLinkActive, type CareLinkLifecycle } from './careLinkLifecycle';
import {
  type CareAlert,
  type CareAlertStatus,
  type CareAuditEntry,
  type CareAppointment,
  type CareCheckin,
  type CareDashboardSummary,
  type CarePlan,
  type CareSupportAction,
  type CareTeamMember,
  type CaregiverNote,
} from './careTypes';

export type CaregiverLink = {
  id: string;
  invite_code: string;
  caregiver_user_id: string;
  cared_user_id: string | null;
  cared_name: string | null;
  relationship: string | null;
  status: 'pending' | 'accepted';
  caregiver_email?: string | null;
  caregiver_display_name?: string | null;
};

// Sem 0/O/1/I — evita confusão ao digitar o código à mão.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function isLinkLifecycleColumnsMissing(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown } | null | undefined;
  if (candidate?.code !== '42703') return false;
  const description = [candidate?.message, candidate?.details]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return description.includes('revoked_at') || description.includes('expires_at');
}

function normalizedInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function hasErrorMessage(error: { message?: unknown }, identifier: string): boolean {
  return typeof error.message === 'string' && error.message.toLowerCase().includes(identifier);
}

async function generateInviteCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(6);
  const suffix = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `MEL-${suffix}`;
}

export async function createInvite(
  caregiverUserId: string,
  caredName: string,
  relationship: string
): Promise<CaregiverLink> {
  // Colisão de código é praticamente impossível (33^6 combinações), mas
  // ainda assim tratada com uma nova tentativa, como o backend antigo fazia.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invite_code = await generateInviteCode();
    const invite = { invite_code, caregiver_user_id: caregiverUserId, cared_name: caredName || null, relationship: relationship || null };
    const { data, error } = await supabase.from('caregiver_links').insert(invite).select('*').single();
    if (!error && data) return data as CaregiverLink;
    if (error?.code !== '23505') throw toCareClientError(error, 'Não foi possível criar o convite.');
  }
  throw new Error('Não foi possível gerar um código único. Tente novamente.');
}

/** Reaproveita um convite pendente já existente do cuidador, se houver, em
 * vez de gerar um novo toda vez que a tela é aberta. */
export async function getOrCreatePendingInvite(caregiverUserId: string): Promise<CaregiverLink> {
  const now = new Date().toISOString();
  let { data: existing, error } = await supabase
    .from('caregiver_links')
    .select('*')
    .eq('caregiver_user_id', caregiverUserId)
    .eq('status', 'pending')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Keep the invite flow working on an installation that predates lifecycle
  // fields, but never treat an ordinary network/RLS failure as "no invite".
  if (error && isLinkLifecycleColumnsMissing(error)) {
    ({ data: existing, error } = await supabase
      .from('caregiver_links')
      .select('*')
      .eq('caregiver_user_id', caregiverUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle());
  }
  if (error) throw toCareClientError(error, 'Não foi possível verificar seu convite atual.');
  if (existing && isCareLinkActive(existing as CareLinkLifecycle)) return existing as CaregiverLink;
  return createInvite(caregiverUserId, '', '');
}

export async function acceptInvite(inviteCode: string, _userId: string): Promise<CaregiverLink> {
  const code = normalizedInviteCode(inviteCode);
  if (!code) throw new Error('Informe o código de convite.');

  const { data, error } = await supabase.rpc('accept_invite', { code });
  if (error) {
    if (error.code === 'P0002') throw new Error('Código de convite não encontrado.');
    if (error.code === '23505') throw new Error('Este convite já foi aceito.');
    if (error.code === '22023' && hasErrorMessage(error, 'invite_expired')) throw new Error('Este convite expirou. Peça um novo código ao cuidador.');
    if (error.code === '22023' && hasErrorMessage(error, 'invite_revoked')) throw new Error('Este convite foi revogado pelo cuidador.');
    if (error.code === '22023') throw new Error('Você não pode aceitar seu próprio convite.');
    throw toCareClientError(error, 'Não foi possível aceitar o convite.');
  }
  if (!data) throw new Error('O convite não retornou uma conexão válida. Tente novamente.');
  return data as CaregiverLink;
}

export async function listLinks(userId: string, role: 'care' | 'user'): Promise<{ links: CaregiverLink[] }> {
  const column = role === 'care' ? 'caregiver_user_id' : 'cared_user_id';
  const now = new Date().toISOString();
  let { data, error } = await supabase
    .from('caregiver_links')
    .select('*')
    .eq(column, userId)
    .eq('status', 'accepted')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  // The lifecycle columns were added after the first caregiver-link schema.
  // Retrying the legacy query is intentional: old installations do not have
  // revoked/expired access to filter yet, while current installations must
  // never pass inactive links to the UI.
  if (error && isLinkLifecycleColumnsMissing(error)) {
    ({ data, error } = await supabase
      .from('caregiver_links')
      .select('*')
      .eq(column, userId)
      .eq('status', 'accepted'));
  }
  // A falha da consulta principal não pode ser interpretada como uma lista
  // vazia: isso faria a interface dizer que não há vínculos quando, na
  // verdade, a rede ou a autorização falharam.
  if (error) throw toCareClientError(error, 'Não foi possível carregar as conexões de cuidado.');
  if (!data) return { links: [] };
  // Keep the client-side guard too: it prevents a stale/cached response from
  // rendering an access that has just been revoked or expired. Legacy rows do
  // not carry these fields and therefore remain eligible in the fallback.
  const base = (data as CareLinkLifecycle[])
    .filter((link) => isCareLinkActive(link)) as CaregiverLink[];
  if (base.length === 0) return { links: base };

  if (role !== 'user') return { links: base };

  const caregiverIds = [...new Set(base.map((link) => link.caregiver_user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, email, display_name').in('id', caregiverIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    links: base.map((link) => ({
      ...link,
      caregiver_email: byId.get(link.caregiver_user_id)?.email ?? null,
      caregiver_display_name: byId.get(link.caregiver_user_id)?.display_name ?? null,
    })) as CaregiverLink[],
  };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function fetchCareDashboardSummary(caredUserId: string, hours = 168): Promise<CareDashboardSummary> {
  const { data, error } = await supabase.rpc('care_dashboard_summary', {
    p_cared_user_id: caredUserId,
    p_hours: hours,
  });
  if (error || !data) throw toCareClientError(error, error?.message || 'Não foi possível carregar o resumo de cuidado.');
  const raw = data as Record<string, unknown>;
  return {
    events: Number(raw.events) || 0,
    last_event_at: typeof raw.last_event_at === 'string' ? raw.last_event_at : null,
    mean_confidence: Number(raw.mean_confidence) || 0,
    distribution: asArray(raw.distribution),
    hourly: asArray(raw.hourly),
    daily: asArray(raw.daily),
    sources: asArray(raw.sources),
  };
}

export async function listCareAlerts(caredUserId: string): Promise<CareAlert[]> {
  const { data, error } = await supabase
    .from('care_alerts')
    .select('id, cared_user_id, caregiver_link_id, kind, severity, title, detail, evidence, status, occurred_at, acknowledged_at, resolved_at')
    .eq('cared_user_id', caredUserId)
    .order('occurred_at', { ascending: false });
  if (error) throw toCareClientError(error, 'Não foi possível carregar os alertas.');
  return (data ?? []) as CareAlert[];
}

export async function updateCareAlert(alertId: string, status: CareAlertStatus, actorUserId: string): Promise<void> {
  const now = new Date().toISOString();
  const patch =
    status === 'acknowledged'
      ? { status, acknowledged_at: now, acknowledged_by: actorUserId }
      : status === 'resolved'
        ? { status, resolved_at: now, resolved_by: actorUserId }
        : { status };
  const { error } = await supabase.from('care_alerts').update(patch).eq('id', alertId);
  if (error) throw toCareClientError(error, 'Não foi possível atualizar o alerta.');
}

export async function listCareCheckins(caredUserId: string): Promise<CareCheckin[]> {
  const { data, error } = await supabase
    .from('care_checkins')
    .select('id, cared_user_id, caregiver_link_id, scheduled_for, prompt, status, response, completed_at')
    .eq('cared_user_id', caredUserId)
    .order('scheduled_for', { ascending: true });
  if (error) throw toCareClientError(error, 'Não foi possível carregar os check-ins.');
  return (data ?? []) as CareCheckin[];
}

export async function createCareCheckin(
  caredUserId: string,
  caregiverLinkId: string | null,
  prompt: string,
  scheduledFor: string,
  actorUserId: string
): Promise<void> {
  const { error } = await supabase.from('care_checkins').insert({
    cared_user_id: caredUserId,
    caregiver_link_id: caregiverLinkId,
    prompt,
    scheduled_for: scheduledFor,
    created_by: actorUserId,
  });
  if (error) throw toCareClientError(error, 'Não foi possível agendar o check-in.');
}

export async function listCareAppointments(caredUserId: string): Promise<CareAppointment[]> {
  const { data, error } = await supabase
    .from('care_appointments')
    .select('id, cared_user_id, caregiver_link_id, title, starts_at, ends_at, notes')
    .eq('cared_user_id', caredUserId)
    .gte('starts_at', new Date(Date.now() - 24 * 3_600_000).toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw toCareClientError(error, 'Não foi possível carregar a agenda.');
  return (data ?? []) as CareAppointment[];
}

export async function createCareAppointment(
  caredUserId: string,
  caregiverLinkId: string | null,
  title: string,
  startsAt: string,
  actorUserId: string
): Promise<void> {
  const { error } = await supabase.from('care_appointments').insert({
    cared_user_id: caredUserId,
    caregiver_link_id: caregiverLinkId,
    title,
    starts_at: startsAt,
    created_by: actorUserId,
  });
  if (error) throw toCareClientError(error, 'Não foi possível salvar o compromisso.');
}

export async function fetchCarePlan(caredUserId: string): Promise<CarePlan | null> {
  const { data, error } = await supabase
    .from('care_plans')
    .select('id, cared_user_id, title, warning_signs, steps, emergency_contacts, updated_at')
    .eq('cared_user_id', caredUserId)
    .maybeSingle();
  if (error) throw toCareClientError(error, 'Não foi possível carregar o plano de cuidado.');
  return (data as CarePlan | null) ?? null;
}

export async function saveCarePlan(
  caredUserId: string,
  actorUserId: string,
  patch: Pick<CarePlan, 'title' | 'warning_signs' | 'steps' | 'emergency_contacts'>
): Promise<void> {
  const { error } = await supabase
    .from('care_plans')
    .upsert({ cared_user_id: caredUserId, updated_by: actorUserId, ...patch }, { onConflict: 'cared_user_id' });
  if (error) throw toCareClientError(error, 'Não foi possível salvar o plano de cuidado.');
}

export async function listCareTeam(caredUserId: string): Promise<CareTeamMember[]> {
  const { data, error } = await supabase
    .from('care_team_members')
    .select('id, cared_user_id, name, role, contact, can_receive_alerts')
    .eq('cared_user_id', caredUserId)
    .order('created_at');
  if (error) throw toCareClientError(error, 'Não foi possível carregar a equipe de cuidado.');
  return (data ?? []) as CareTeamMember[];
}

export async function createCareTeamMember(
  caredUserId: string,
  actorUserId: string,
  input: Pick<CareTeamMember, 'name' | 'role' | 'contact' | 'can_receive_alerts'>
): Promise<void> {
  const { error } = await supabase.from('care_team_members').insert({
    cared_user_id: caredUserId,
    created_by: actorUserId,
    ...input,
  });
  if (error) throw toCareClientError(error, 'Não foi possível adicionar esta pessoa à equipe.');
}

export async function listPrivateNotes(caregiverUserId: string, caredUserId: string): Promise<CaregiverNote[]> {
  const { data, error } = await supabase
    .from('caregiver_notes')
    .select('id, body, created_at')
    .eq('caregiver_user_id', caregiverUserId)
    .eq('cared_user_id', caredUserId)
    .order('created_at', { ascending: false });
  if (error) throw toCareClientError(error, 'Não foi possível carregar as notas privadas.');
  return (data ?? []) as CaregiverNote[];
}

export async function createPrivateNote(caregiverUserId: string, caredUserId: string, body: string): Promise<void> {
  const { error } = await supabase.from('caregiver_notes').insert({
    caregiver_user_id: caregiverUserId,
    cared_user_id: caredUserId,
    body,
  });
  if (error) throw toCareClientError(error, 'Não foi possível salvar a nota privada.');
}

export async function listSupportActions(caredUserId: string): Promise<CareSupportAction[]> {
  const { data, error } = await supabase
    .from('care_support_actions')
    .select('id, kind, detail, outcome, created_at')
    .eq('cared_user_id', caredUserId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw toCareClientError(error, 'Não foi possível carregar as ações de apoio.');
  return (data ?? []) as CareSupportAction[];
}

export async function createSupportAction(
  caredUserId: string,
  caregiverLinkId: string | null,
  actorUserId: string,
  kind: string,
  detail?: string
): Promise<void> {
  const { error } = await supabase.from('care_support_actions').insert({
    cared_user_id: caredUserId,
    caregiver_link_id: caregiverLinkId,
    created_by: actorUserId,
    kind,
    detail: detail ?? null,
  });
  if (error) throw toCareClientError(error, 'Não foi possível registrar a ação de apoio.');
}

/**
 * A projection for the care audit timeline. Do not add `metadata` here:
 * it is internal operational data and the timeline purposefully shows no
 * contents from care artifacts.
 */
export async function listCareAuditEntries(caredUserId: string): Promise<CareAuditEntry[]> {
  const { data, error } = await supabase
    .from('care_audit_log')
    .select('id, action, created_at')
    .eq('cared_user_id', caredUserId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw toCareClientError(error, 'Não foi possível carregar o histórico de cuidado.');
  return (data ?? []) as CareAuditEntry[];
}

/**
 * Ends a connection without deleting its operational trail. The database also
 * marks the historical consent record as revoked too, so audit history stays
 * aligned with the link lifecycle.
 */
export async function revokeCareLink(linkId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_care_link', { p_link_id: linkId });
  if (!error) return;
  if (error.code === 'P0002') throw new Error('Este vínculo já não está disponível. Atualize a tela.');
  if (error.code === '42501') throw new Error('Você não tem permissão para encerrar este vínculo.');
  throw toCareClientError(error, 'Não foi possível encerrar a conexão agora.');
}
