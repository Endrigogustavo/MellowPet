-- Auditoria operacional sem conteúdo sensível: registra quem alterou qual
-- artefato e quando, mas nunca inclui texto de notas, respostas ou evidências.
create or replace function private.log_care_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_cared_user_id uuid := (v_row ->> 'cared_user_id')::uuid;
  v_link_id uuid := nullif(v_row ->> 'caregiver_link_id', '')::uuid;
  v_record_id uuid := nullif(v_row ->> 'id', '')::uuid;
begin
  -- caregiver_links só passa a ser auditável quando há uma pessoa acompanhada.
  if v_cared_user_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.care_audit_log (
    cared_user_id, caregiver_link_id, actor_user_id, action, metadata
  ) values (
    v_cared_user_id,
    v_link_id,
    coalesce(auth.uid(), v_cared_user_id),
    tg_table_schema || '.' || tg_table_name || '.' || lower(tg_op),
    jsonb_build_object('record_id', v_record_id)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists caregiver_consents_audit on public.caregiver_consents;
create trigger caregiver_consents_audit after insert or update or delete on public.caregiver_consents
for each row execute function private.log_care_audit();
drop trigger if exists care_alerts_audit on public.care_alerts;
create trigger care_alerts_audit after insert or update on public.care_alerts
for each row execute function private.log_care_audit();
drop trigger if exists care_checkins_audit on public.care_checkins;
create trigger care_checkins_audit after insert or update or delete on public.care_checkins
for each row execute function private.log_care_audit();
drop trigger if exists care_appointments_audit on public.care_appointments;
create trigger care_appointments_audit after insert or update or delete on public.care_appointments
for each row execute function private.log_care_audit();
drop trigger if exists care_plans_audit on public.care_plans;
create trigger care_plans_audit after insert or update or delete on public.care_plans
for each row execute function private.log_care_audit();
drop trigger if exists care_team_members_audit on public.care_team_members;
create trigger care_team_members_audit after insert or update or delete on public.care_team_members
for each row execute function private.log_care_audit();
drop trigger if exists care_support_actions_audit on public.care_support_actions;
create trigger care_support_actions_audit after insert or update or delete on public.care_support_actions
for each row execute function private.log_care_audit();
drop trigger if exists caregiver_links_audit on public.caregiver_links;
create trigger caregiver_links_audit after update on public.caregiver_links
for each row execute function private.log_care_audit();

revoke all on function private.log_care_audit() from public, anon, authenticated;
