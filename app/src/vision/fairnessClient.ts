import { listCheckins } from '../checkins/checkinClient';
import { supabase } from '../supabase/client';
import { EMPTY_PROFILE, personalAgreement, type AuditProfile, type GroupRow } from './fairness';

const MISSING = 'Aplique supabase/migrations/202610220003_vision_fairness.sql.';

type ProfileRow = {
  glasses: AuditProfile['glasses'];
  age_band: AuditProfile['ageBand'];
  facial_hair: AuditProfile['facialHair'];
};

function describe(error: { code?: string; message: string }, action: string) {
  // 42P01 = tabela não existe; PGRST202 = função não existe.
  if (error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205') {
    return new Error(`${action}: o servidor ainda não tem a auditoria. ${MISSING}`);
  }
  return new Error(`${action}: ${error.message}`);
}

export async function loadAuditProfile(userId: string): Promise<AuditProfile> {
  const { data, error } = await supabase
    .from('vision_audit_profile')
    .select('glasses, age_band, facial_hair')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw describe(error, 'Não foi possível carregar seus dados da auditoria');
  if (!data) return EMPTY_PROFILE;
  const row = data as ProfileRow;
  return { glasses: row.glasses, ageBand: row.age_band, facialHair: row.facial_hair };
}

export async function saveAuditProfile(userId: string, p: AuditProfile): Promise<void> {
  const { error } = await supabase.from('vision_audit_profile').upsert({
    user_id: userId,
    glasses: p.glasses,
    age_band: p.ageBand,
    facial_hair: p.facialHair,
    updated_at: new Date().toISOString(),
  });
  if (error) throw describe(error, 'Não foi possível salvar');
}

export async function deleteAuditProfile(userId: string): Promise<void> {
  const { error } = await supabase.from('vision_audit_profile').delete().eq('user_id', userId);
  if (error) throw describe(error, 'Não foi possível apagar');
}

/** Agregados da comunidade. A RPC só devolve grupos com k ≥ 5 pessoas. */
export async function fetchFairnessReport(): Promise<GroupRow[]> {
  const { data, error } = await supabase.rpc('vision_fairness_report', { min_users: 5 });
  if (error) throw describe(error, 'Não foi possível carregar o relatório');
  return ((data ?? []) as { attribute: string; grp: string; users: number; samples: number; agree: number }[]).map(
    (r) => ({
      attribute: r.attribute,
      grp: r.grp,
      users: Number(r.users),
      samples: Number(r.samples),
      agree: Number(r.agree),
    })
  );
}

/** Seus check-ins dos últimos 180 dias, comparados com o que a câmera lia. */
export async function fetchPersonalAgreement(userId: string) {
  const since = Date.now() - 180 * 24 * 3600 * 1000;
  const checkins = await listCheckins(userId, since);
  return personalAgreement(checkins.map((c) => ({ said: c.emotion, seen: c.detectedEmotion })));
}
