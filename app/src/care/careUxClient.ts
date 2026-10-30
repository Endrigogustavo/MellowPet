import { apiPost } from '../api/client';
import { supabase } from '../supabase/client';
import {
  acceptInvite,
  acceptResult,
  fetchCareDashboardSummary,
  fetchCarePlan,
  listCareAppointments,
  listCareCheckins,
  normalizedInviteCode,
  type CaregiverLink,
} from './careClient';
import { deviceTimeZone } from './careDateTime';
import { isCareConfigurationMissing, toCareClientError } from './careErrors';
import { fallbackHours, fillHistory, historyFromDaily, HISTORY_PERIODS } from './careHistory';
import { normalizeNoteRow } from './careNotes';
import { normalizeTime } from './careNotifyPrefs';
import type { CareAppointment, CareCheckin, CarePlan } from './careTypes';
import {
  CARE_TERMS_VERSION,
  DEFAULT_ALERT_RULE,
  DEFAULT_NOTIFICATION_PREFS,
  type CareAlertRule,
  type CareHistoryBucket,
  type CareNote,
  type CareNotificationPrefs,
  type DifficultEmotion,
  type HistoryGranularity,
  type WeeklySummaryInput,
  type WeeklySummaryOutput,
} from './careUxTypes';

/**
 * Clientes da nova área do cuidador (plano §4). A migration
 * 202610300001_care_ux.sql pode ainda não estar aplicada: toda leitura cai
 * num padrão (`unavailable: true`) em vez de quebrar a tela, e toda escrita
 * explica que o recurso ainda não foi ativado.
 */
export type Degradable<T> = { value: T; unavailable: boolean };

export const NOT_ACTIVE_YET = 'Este recurso ainda não foi ativado no servidor.';

function notActive(): Error {
  return new Error(NOT_ACTIVE_YET);
}

type PgError = { code?: string; message?: string; details?: string } | null;

/** Coluna `note_day` (ou outra coluna nova) ausente no servidor. */
function isMissingColumn(error: PgError, column: string): boolean {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (error.code === '42703' || error.code === 'PGRST204' || text.includes('schema cache')) && text.includes(column);
}

// ── anotações por dia ────────────────────────────────────────────────────────
export type NotesResult = { notes: CareNote[]; dayColumn: boolean };

const NOTE_COLUMNS = 'id, body, created_at, updated_at, cared_user_id, caregiver_user_id';

export async function listCareNotes(link: CaregiverLink, caregiverId: string): Promise<NotesResult> {
  if (!link.cared_user_id) return { notes: [], dayColumn: false };
  const query = (columns: string) =>
    supabase
      .from('caregiver_notes')
      .select(columns)
      .eq('caregiver_user_id', caregiverId)
      .eq('cared_user_id', link.cared_user_id!)
      .order('created_at', { ascending: false })
      .limit(300);
  let dayColumn = true;
  let { data, error } = await query(`${NOTE_COLUMNS}, note_day`);
  if (isMissingColumn(error, 'note_day')) {
    dayColumn = false;
    ({ data, error } = await query(NOTE_COLUMNS));
  }
  if (error) throw toCareClientError(error, 'Não foi possível carregar as anotações.');
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const notes = rows.map((row) => normalizeNoteRow(row, link.id)).filter((n): n is CareNote => n !== null);
  return { notes, dayColumn };
}

export async function createCareNote(
  link: CaregiverLink,
  caregiverId: string,
  body: string,
  noteDay: string,
  dayColumn: boolean
): Promise<void> {
  if (!link.cared_user_id) throw new Error('Esta pessoa ainda não aceitou o convite.');
  const row: Record<string, string> = { caregiver_user_id: caregiverId, cared_user_id: link.cared_user_id, body };
  if (dayColumn) row.note_day = noteDay;
  const { error } = await supabase.from('caregiver_notes').insert(row);
  if (error) throw noteWriteError(error, 'Não foi possível guardar a anotação.');
}

export async function updateCareNote(id: string, body: string, noteDay: string | null): Promise<void> {
  const patch: Record<string, string> = { body };
  if (noteDay) patch.note_day = noteDay;
  const { data, error } = await supabase.from('caregiver_notes').update(patch).eq('id', id).select('id');
  if (error) throw noteWriteError(error, 'Não foi possível salvar a edição.');
  if (!data || data.length === 0) throw new Error('A edição não foi salva. O compartilhamento pode estar pausado.');
}

export async function deleteCareNote(id: string): Promise<void> {
  const { data, error } = await supabase.from('caregiver_notes').delete().eq('id', id).select('id');
  if (error) throw noteWriteError(error, 'Não foi possível apagar a anotação.');
  if (!data || data.length === 0) throw new Error('A anotação não foi apagada. O compartilhamento pode estar pausado.');
}

function noteWriteError(error: PgError, fallback: string): Error {
  if (isCareConfigurationMissing(error) || error?.code === '42501') {
    return new Error(`${fallback} ${NOT_ACTIVE_YET}`);
  }
  return toCareClientError(error, fallback);
}

// ── preferências de notificação ──────────────────────────────────────────────
export async function fetchNotificationPrefs(linkId: string): Promise<Degradable<CareNotificationPrefs>> {
  const fallback: CareNotificationPrefs = { caregiver_link_id: linkId, ...DEFAULT_NOTIFICATION_PREFS };
  const { data, error } = await supabase
    .from('care_notification_prefs')
    .select('caregiver_link_id, push_alerts, push_requests, weekly_digest, quiet_start, quiet_end')
    .eq('caregiver_link_id', linkId)
    .maybeSingle();
  if (error) {
    if (isCareConfigurationMissing(error)) return { value: fallback, unavailable: true };
    throw toCareClientError(error, 'Não foi possível carregar as preferências de notificação.');
  }
  if (!data) return { value: fallback, unavailable: false };
  const row = data as Record<string, unknown>;
  return {
    unavailable: false,
    value: {
      caregiver_link_id: linkId,
      push_alerts: row.push_alerts !== false,
      push_requests: row.push_requests !== false,
      weekly_digest: row.weekly_digest !== false,
      quiet_start: normalizeTime(row.quiet_start),
      quiet_end: normalizeTime(row.quiet_end),
    },
  };
}

export async function saveNotificationPrefs(prefs: CareNotificationPrefs): Promise<void> {
  const { error } = await supabase.from('care_notification_prefs').upsert(prefs, { onConflict: 'caregiver_link_id' });
  if (!error) return;
  if (isCareConfigurationMissing(error)) throw notActive();
  throw toCareClientError(error, 'Não foi possível salvar as preferências.');
}

// ── regras de alerta ─────────────────────────────────────────────────────────
export type AlertRuleState = { rule: CareAlertRule; isDefault: boolean };

const EMOTIONS: DifficultEmotion[] = ['sad', 'angry', 'fearful', 'disgusted'];

export async function fetchAlertRule(linkId: string): Promise<Degradable<AlertRuleState>> {
  const fallback: AlertRuleState = { rule: { caregiver_link_id: linkId, ...DEFAULT_ALERT_RULE }, isDefault: true };
  const { data, error } = await supabase
    .from('care_alert_rules')
    .select('caregiver_link_id, enabled, min_readings, window_minutes, emotions')
    .eq('caregiver_link_id', linkId)
    .maybeSingle();
  if (error) {
    if (isCareConfigurationMissing(error)) return { value: fallback, unavailable: true };
    throw toCareClientError(error, 'Não foi possível carregar a regra de alerta.');
  }
  if (!data) return { value: fallback, unavailable: false };
  const row = data as Record<string, unknown>;
  const emotions = Array.isArray(row.emotions) ? EMOTIONS.filter((e) => (row.emotions as unknown[]).includes(e)) : DEFAULT_ALERT_RULE.emotions;
  return {
    unavailable: false,
    value: {
      isDefault: false,
      rule: {
        caregiver_link_id: linkId,
        enabled: row.enabled !== false,
        min_readings: Number(row.min_readings) || DEFAULT_ALERT_RULE.min_readings,
        window_minutes: Number(row.window_minutes) || DEFAULT_ALERT_RULE.window_minutes,
        emotions,
      },
    },
  };
}

export async function saveAlertRule(rule: CareAlertRule): Promise<void> {
  const { error } = await supabase.from('care_alert_rules').upsert(rule, { onConflict: 'caregiver_link_id' });
  if (!error) return;
  if (isCareConfigurationMissing(error)) throw notActive();
  if (error.code === '23514') throw new Error('A regra está fora dos limites aceitos (2 a 10 leituras, 30 a 360 minutos).');
  throw toCareClientError(error, 'Não foi possível salvar a regra.');
}

// ── histórico dia/semana/mês ─────────────────────────────────────────────────
export async function fetchCareHistory(caredUserId: string, granularity: HistoryGranularity): Promise<Degradable<CareHistoryBucket[]>> {
  const periods = HISTORY_PERIODS[granularity];
  const tz = deviceTimeZone();
  const { data, error } = await supabase.rpc('care_history', {
    p_cared: caredUserId,
    p_granularity: granularity,
    p_periods: periods,
    p_tz: tz.includes('/') ? tz : 'America/Sao_Paulo',
  });
  if (!error) {
    const rows = Array.isArray(data) ? (data as Partial<CareHistoryBucket>[]) : [];
    return { value: fillHistory(rows, granularity, periods), unavailable: false };
  }
  if (!isCareConfigurationMissing(error)) throw toCareClientError(error, 'Não foi possível carregar o histórico.');
  // Reserva: resumo diário antigo (até 90 dias, dias em UTC).
  const summary = await fetchCareDashboardSummary(caredUserId, fallbackHours(granularity, periods));
  return { value: historyFromDaily(summary.daily, granularity, periods), unavailable: true };
}

// ── resumo semanal por IA ────────────────────────────────────────────────────
/** Mesma auth/cota do /care/chat. `text: null` = sem IA: o app usa o resumo por regras. */
export async function fetchWeeklySummary(input: WeeklySummaryInput): Promise<WeeklySummaryOutput> {
  const res = await apiPost<Partial<WeeklySummaryOutput>>('/api/v1/care/weekly', input);
  return { text: typeof res.text === 'string' && res.text.trim() ? res.text.trim() : null, provider: res.provider ?? 'none' };
}

// ── aceite com consentimento ─────────────────────────────────────────────────
export type AcceptOutcome = { link: CaregiverLink; consentRecorded: boolean };

/**
 * Aceita gravando a versão do termo. Servidor sem a RPC nova → cai no
 * accept_invite de antes (o vínculo funciona; só o registro do termo falta).
 */
export async function acceptInviteWithConsent(inviteCode: string, userId: string): Promise<AcceptOutcome> {
  const code = normalizedInviteCode(inviteCode);
  if (!code) throw new Error('Informe o código de convite.');
  const { data, error } = await supabase.rpc('accept_invite_with_consent', { p_code: code, p_terms_version: CARE_TERMS_VERSION });
  if (error && isCareConfigurationMissing(error)) {
    return { link: await acceptInvite(code, userId), consentRecorded: false };
  }
  return { link: acceptResult(data, error), consentRecorded: true };
}

// ── convites do cuidador (status no painel) ──────────────────────────────────
export type InviteRow = Pick<CaregiverLink, 'id' | 'invite_code' | 'status' | 'cared_name'> & {
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  accepted_at: string | null;
};

export async function listMyInvites(caregiverId: string): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from('caregiver_links')
    .select('*')
    .eq('caregiver_user_id', caregiverId)
    .order('created_at', { ascending: false })
    .limit(6);
  if (error) throw toCareClientError(error, 'Não foi possível ver o status do convite.');
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    invite_code: String(row.invite_code ?? ''),
    status: row.status === 'accepted' ? 'accepted' : 'pending',
    cared_name: typeof row.cared_name === 'string' ? row.cared_name : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
    revoked_at: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    accepted_at: typeof row.accepted_at === 'string' ? row.accepted_at : null,
  }));
}

// ── lado da pessoa: "Do meu cuidador" ────────────────────────────────────────
export type FromCaregivers = {
  plan: CarePlan | null;
  appointments: CareAppointment[];
  checkins: CareCheckin[];
  /** Partes que não puderam ser lidas (servidor sem a policy, rede…). */
  failed: ('plan' | 'appointments' | 'checkins')[];
};

export async function fetchFromCaregivers(userId: string): Promise<FromCaregivers> {
  const [plan, appointments, checkins] = await Promise.allSettled([
    fetchCarePlan(userId),
    listCareAppointments(userId),
    listCareCheckins(userId),
  ]);
  const failed: FromCaregivers['failed'] = [];
  if (plan.status === 'rejected') failed.push('plan');
  if (appointments.status === 'rejected') failed.push('appointments');
  if (checkins.status === 'rejected') failed.push('checkins');
  if (failed.length === 3) {
    const reason = plan.status === 'rejected' ? plan.reason : null;
    throw reason instanceof Error ? reason : new Error('Não foi possível carregar o que seu cuidador combinou.');
  }
  const now = Date.now();
  return {
    plan: plan.status === 'fulfilled' ? plan.value : null,
    appointments: appointments.status === 'fulfilled' ? appointments.value : [],
    checkins:
      checkins.status === 'fulfilled'
        ? checkins.value.filter((c) => c.status === 'scheduled' && Date.parse(c.scheduled_for) >= now - 3_600_000).slice(0, 8)
        : [],
    failed,
  };
}
