-- Vínculos aceitos liberam todo o módulo de cuidado. Os registros legados de
-- consentimento permanecem apenas para auditoria e não participam mais da
-- autorização, nem podem ser modificados pelos clientes.

create or replace function private.care_link_for(p_cared_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select l.id
  from public.caregiver_links l
  where l.caregiver_user_id = (select auth.uid())
    and l.cared_user_id = p_cared_user_id
    and l.status = 'accepted'
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;

create or replace function private.care_scope_enabled(p_cared_user_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (select auth.uid()) = p_cared_user_id
    or exists (
      select 1
      from public.caregiver_links l
      where l.caregiver_user_id = (select auth.uid())
        and l.cared_user_id = p_cared_user_id
        and l.status = 'accepted'
        and l.revoked_at is null
        and (l.expires_at is null or l.expires_at > now())
    );
$$;

create or replace function private.create_persistent_signal_alert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_negative_count integer;
  v_link record;
begin
  if new.emotion not in ('sad', 'angry', 'disgusted', 'fearful') then
    return new;
  end if;

  select count(*) into v_negative_count
  from (
    select emotion
    from public.emotion_events
    where user_id = new.user_id and created_at >= new.created_at - interval '90 minutes'
    order by created_at desc
    limit 3
  ) recent
  where emotion in ('sad', 'angry', 'disgusted', 'fearful');

  if v_negative_count < 3 then return new; end if;

  for v_link in
    select l.id
    from public.caregiver_links l
    where l.cared_user_id = new.user_id
      and l.status = 'accepted'
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
  loop
    if not exists (
      select 1 from public.care_alerts a
      where a.caregiver_link_id = v_link.id
        and a.kind = 'persistent_difficult_signal'
        and a.status in ('open', 'acknowledged')
        and a.occurred_at > new.created_at - interval '6 hours'
    ) then
      insert into public.care_alerts (cared_user_id, caregiver_link_id, kind, severity, title, detail, evidence)
      values (
        new.user_id,
        v_link.id,
        'persistent_difficult_signal',
        'attention',
        'Sinal persistente para acompanhar',
        'Foram registradas leituras difíceis repetidas. Isso não é um diagnóstico; priorize um check-in respeitoso.',
        jsonb_build_object('window_minutes', 90, 'readings', v_negative_count, 'latest_emotion', new.emotion)
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke all on table public.caregiver_consents from authenticated;
drop policy if exists "consent visible to link participants" on public.caregiver_consents;
drop policy if exists "cared person creates consent for own link" on public.caregiver_consents;
drop policy if exists "cared person updates own consent" on public.caregiver_consents;
drop policy if exists "cared person deletes own consent" on public.caregiver_consents;

comment on function private.care_scope_enabled(uuid, text) is
  'Compatibility helper: an accepted, unrevoked, unexpired caregiver link grants every care capability.';
