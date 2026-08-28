-- Módulo de cuidado: consentimento granular, dados agregados e artefatos
-- operacionais. Aplique pelo Supabase CLI ou pelo SQL Editor antes de publicar
-- uma build que usa as telas de cuidador.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter table public.caregiver_links
  add column if not exists revoked_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists requested_scopes jsonb not null default '{"summary":true,"trends":true,"alerts":true,"checkins":true,"agenda":true,"care_plan":true,"support_actions":true,"audit":true}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.caregiver_consents (
  id uuid primary key default gen_random_uuid(),
  caregiver_link_id uuid not null unique references public.caregiver_links(id) on delete cascade,
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  scopes jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'revoked')),
  consent_version integer not null default 1,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.care_alerts (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_link_id uuid references public.caregiver_links(id) on delete cascade,
  kind text not null,
  severity text not null default 'attention' check (severity in ('info', 'attention', 'urgent')),
  title text not null,
  detail text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  occurred_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_alerts_cared_open_idx
  on public.care_alerts (cared_user_id, occurred_at desc)
  where status in ('open', 'acknowledged');

create table if not exists public.care_checkins (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_link_id uuid references public.caregiver_links(id) on delete cascade,
  scheduled_for timestamptz not null,
  prompt text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped', 'cancelled')),
  response text,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_checkins_cared_when_idx
  on public.care_checkins (cared_user_id, scheduled_for);

create table if not exists public.care_appointments (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_link_id uuid references public.caregiver_links(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_appointments_cared_starts_idx
  on public.care_appointments (cared_user_id, starts_at);

create table if not exists public.care_plans (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null default 'Plano de cuidado',
  warning_signs text[] not null default '{}',
  steps text[] not null default '{}',
  emergency_contacts jsonb not null default '[]'::jsonb,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_team_members (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  contact text,
  can_receive_alerts boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.caregiver_notes (
  id uuid primary key default gen_random_uuid(),
  caregiver_user_id uuid not null references auth.users(id) on delete cascade,
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_support_actions (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_link_id uuid references public.caregiver_links(id) on delete cascade,
  kind text not null,
  detail text,
  outcome text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_audit_log (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_link_id uuid references public.caregiver_links(id) on delete set null,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists care_audit_log_cared_created_idx
  on public.care_audit_log (cared_user_id, created_at desc);

create or replace function private.touch_care_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists caregiver_links_touch_updated_at on public.caregiver_links;
create trigger caregiver_links_touch_updated_at before update on public.caregiver_links
for each row execute function private.touch_care_updated_at();

drop trigger if exists caregiver_consents_touch_updated_at on public.caregiver_consents;
create trigger caregiver_consents_touch_updated_at before update on public.caregiver_consents
for each row execute function private.touch_care_updated_at();

drop trigger if exists care_alerts_touch_updated_at on public.care_alerts;
create trigger care_alerts_touch_updated_at before update on public.care_alerts
for each row execute function private.touch_care_updated_at();

drop trigger if exists care_checkins_touch_updated_at on public.care_checkins;
create trigger care_checkins_touch_updated_at before update on public.care_checkins
for each row execute function private.touch_care_updated_at();

drop trigger if exists care_appointments_touch_updated_at on public.care_appointments;
create trigger care_appointments_touch_updated_at before update on public.care_appointments
for each row execute function private.touch_care_updated_at();

drop trigger if exists care_team_members_touch_updated_at on public.care_team_members;
create trigger care_team_members_touch_updated_at before update on public.care_team_members
for each row execute function private.touch_care_updated_at();

drop trigger if exists caregiver_notes_touch_updated_at on public.caregiver_notes;
create trigger caregiver_notes_touch_updated_at before update on public.caregiver_notes
for each row execute function private.touch_care_updated_at();

drop trigger if exists care_support_actions_touch_updated_at on public.care_support_actions;
create trigger care_support_actions_touch_updated_at before update on public.care_support_actions
for each row execute function private.touch_care_updated_at();

create or replace function private.care_link_for(p_cared_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select l.id
  from public.caregiver_links l
  join public.caregiver_consents c on c.caregiver_link_id = l.id
  where l.caregiver_user_id = auth.uid()
    and l.cared_user_id = p_cared_user_id
    and l.status = 'accepted'
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
    and c.status = 'active'
    and c.cared_user_id = p_cared_user_id
  limit 1;
$$;

create or replace function private.care_scope_enabled(p_cared_user_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() = p_cared_user_id
    or exists (
      select 1
      from public.caregiver_links l
      join public.caregiver_consents c on c.caregiver_link_id = l.id
      where l.caregiver_user_id = auth.uid()
        and l.cared_user_id = p_cared_user_id
        and l.status = 'accepted'
        and l.revoked_at is null
        and (l.expires_at is null or l.expires_at > now())
        and c.status = 'active'
        and coalesce((c.scopes ->> p_scope)::boolean, false)
    );
$$;

create or replace function public.care_dashboard_summary(p_cared_user_id uuid, p_hours integer default 168)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_since timestamptz := now() - greatest(1, least(p_hours, 24 * 90)) * interval '1 hour';
  v_result jsonb;
begin
  if not private.care_scope_enabled(p_cared_user_id, 'trends') then
    raise exception 'care_scope_denied' using errcode = '42501';
  end if;

  with filtered as (
    select emotion, created_at, coalesce(confidence, 0)::numeric as confidence, coalesce(source, 'unknown') as source
    from public.emotion_events
    where user_id = p_cared_user_id and created_at >= v_since
  ),
  distribution as (
    select emotion, count(*)::int as count from filtered group by emotion order by count desc, emotion
  ),
  hourly_counts as (
    select date_trunc('hour', created_at) as bucket, emotion, count(*)::int as count
    from filtered group by 1, 2
  ),
  hourly_ranked as (
    select *, row_number() over (partition by bucket order by count desc, emotion) as rn from hourly_counts
  ),
  hourly as (
    select bucket, sum(count)::int as count, max(emotion) filter (where rn = 1) as dominant
    from hourly_ranked group by bucket order by bucket
  ),
  daily_counts as (
    select date_trunc('day', created_at) as bucket, emotion, count(*)::int as count
    from filtered group by 1, 2
  ),
  daily_ranked as (
    select *, row_number() over (partition by bucket order by count desc, emotion) as rn from daily_counts
  ),
  daily as (
    select bucket, sum(count)::int as count, max(emotion) filter (where rn = 1) as dominant
    from daily_ranked group by bucket order by bucket
  ),
  sources as (
    select source, count(*)::int as count from filtered group by source order by count desc, source
  )
  select jsonb_build_object(
    'events', (select count(*)::int from filtered),
    'last_event_at', (select max(created_at) from filtered),
    'mean_confidence', coalesce((select round(avg(confidence) * 100)::int from filtered), 0),
    'distribution', coalesce((select jsonb_agg(jsonb_build_object('emotion', emotion, 'count', count)) from distribution), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('at', bucket, 'count', count, 'dominant', dominant)) from hourly), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('at', bucket, 'count', count, 'dominant', dominant)) from daily), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'count', count)) from sources), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
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
    join public.caregiver_consents c on c.caregiver_link_id = l.id
    where l.cared_user_id = new.user_id
      and l.status = 'accepted'
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
      and c.status = 'active'
      and coalesce((c.scopes ->> 'alerts')::boolean, false)
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

drop trigger if exists emotion_events_persistent_signal_alert on public.emotion_events;
create trigger emotion_events_persistent_signal_alert
after insert on public.emotion_events
for each row execute function private.create_persistent_signal_alert();

-- Os artefatos de cuidado registram o autor autenticado; clientes não podem
-- atribuir uma ação a outra pessoa nem mover um registro para outro vínculo.
create or replace function private.enforce_care_actor_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'care_auth_required' using errcode = '42501';
  end if;

  if tg_table_name = 'care_plans' then
    if tg_op = 'UPDATE' and new.cared_user_id is distinct from old.cared_user_id then
      raise exception 'care_plan_owner_immutable' using errcode = '42501';
    end if;
    if new.updated_by is distinct from auth.uid() then
      raise exception 'care_actor_mismatch' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_table_name = 'caregiver_notes' then
    if new.caregiver_user_id is distinct from auth.uid() then
      raise exception 'care_actor_mismatch' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.cared_user_id is distinct from old.cared_user_id
      or new.caregiver_user_id is distinct from old.caregiver_user_id
      or new.created_at is distinct from old.created_at
    ) then
      raise exception 'care_note_metadata_immutable' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.created_by is distinct from auth.uid() then
    raise exception 'care_actor_mismatch' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (
    new.cared_user_id is distinct from old.cared_user_id
    or new.caregiver_link_id is distinct from old.caregiver_link_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'care_record_metadata_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_care_alert_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'care_auth_required' using errcode = '42501';
  end if;
  if new.cared_user_id is distinct from old.cared_user_id
    or new.caregiver_link_id is distinct from old.caregiver_link_id
    or new.kind is distinct from old.kind
    or new.severity is distinct from old.severity
    or new.title is distinct from old.title
    or new.detail is distinct from old.detail
    or new.evidence is distinct from old.evidence
    or new.occurred_at is distinct from old.occurred_at
    or new.created_at is distinct from old.created_at then
    raise exception 'care_alert_metadata_immutable' using errcode = '42501';
  end if;

  if old.status = 'open' and new.status = 'acknowledged'
    and new.acknowledged_by = auth.uid() and new.acknowledged_at is not null
    and new.resolved_by is null and new.resolved_at is null then
    return new;
  end if;
  if old.status = 'acknowledged' and new.status = 'resolved'
    and new.acknowledged_by = old.acknowledged_by
    and new.acknowledged_at is not distinct from old.acknowledged_at
    and new.resolved_by = auth.uid() and new.resolved_at is not null then
    return new;
  end if;
  raise exception 'care_alert_invalid_transition' using errcode = '42501';
end;
$$;

drop trigger if exists care_checkins_enforce_actor on public.care_checkins;
create trigger care_checkins_enforce_actor before insert or update on public.care_checkins
for each row execute function private.enforce_care_actor_integrity();
drop trigger if exists care_appointments_enforce_actor on public.care_appointments;
create trigger care_appointments_enforce_actor before insert or update on public.care_appointments
for each row execute function private.enforce_care_actor_integrity();
drop trigger if exists care_plans_enforce_actor on public.care_plans;
create trigger care_plans_enforce_actor before insert or update on public.care_plans
for each row execute function private.enforce_care_actor_integrity();
drop trigger if exists care_team_members_enforce_actor on public.care_team_members;
create trigger care_team_members_enforce_actor before insert or update on public.care_team_members
for each row execute function private.enforce_care_actor_integrity();
drop trigger if exists caregiver_notes_enforce_actor on public.caregiver_notes;
create trigger caregiver_notes_enforce_actor before insert or update on public.caregiver_notes
for each row execute function private.enforce_care_actor_integrity();
drop trigger if exists care_support_actions_enforce_actor on public.care_support_actions;
create trigger care_support_actions_enforce_actor before insert or update on public.care_support_actions
for each row execute function private.enforce_care_actor_integrity();
drop trigger if exists care_alerts_enforce_transition on public.care_alerts;
create trigger care_alerts_enforce_transition before update on public.care_alerts
for each row execute function private.enforce_care_alert_transition();

alter table public.caregiver_consents enable row level security;
alter table public.caregiver_links enable row level security;
alter table public.emotion_events enable row level security;
alter table public.care_alerts enable row level security;
alter table public.care_checkins enable row level security;
alter table public.care_appointments enable row level security;
alter table public.care_plans enable row level security;
alter table public.care_team_members enable row level security;
alter table public.caregiver_notes enable row level security;
alter table public.care_support_actions enable row level security;
alter table public.care_audit_log enable row level security;

-- As tabelas novas só ficam disponíveis à role autenticada e cada operação é
-- limitada por vínculo ativo, escopo concedido e autor do registro.
grant select, insert, update on public.caregiver_consents to authenticated;
grant select, update on public.care_alerts to authenticated;
grant select, insert, update on public.care_checkins to authenticated;
grant select, insert, update on public.care_appointments to authenticated;
grant select, insert, update on public.care_plans to authenticated;
grant select, insert, update on public.care_team_members to authenticated;
grant select, insert, update on public.caregiver_notes to authenticated;
grant select, insert, update on public.care_support_actions to authenticated;
grant select on public.care_audit_log to authenticated;

drop policy if exists "consent visible to link participants" on public.caregiver_consents;
drop policy if exists "cared person creates consent for own link" on public.caregiver_consents;
drop policy if exists "cared person updates own consent" on public.caregiver_consents;
drop policy if exists "cared person deletes own consent" on public.caregiver_consents;
create policy "consent visible to link participants" on public.caregiver_consents for select to authenticated
using (
  cared_user_id = (select auth.uid())
  or exists (
    select 1 from public.caregiver_links l
    where l.id = caregiver_link_id
      and l.caregiver_user_id = (select auth.uid())
      and l.status = 'accepted'
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
      and caregiver_consents.status = 'active'
  )
);
create policy "cared person creates consent for own link" on public.caregiver_consents for insert to authenticated
with check (
  cared_user_id = (select auth.uid())
  and exists (
    select 1 from public.caregiver_links l
    where l.id = caregiver_link_id and l.cared_user_id = (select auth.uid()) and l.status = 'accepted'
  )
);
create policy "cared person updates own consent" on public.caregiver_consents for update to authenticated
using (cared_user_id = (select auth.uid()))
with check (
  cared_user_id = (select auth.uid())
  and exists (
    select 1 from public.caregiver_links l
    where l.id = caregiver_link_id and l.cared_user_id = (select auth.uid()) and l.status = 'accepted'
  )
);
create policy "cared person deletes own consent" on public.caregiver_consents for delete to authenticated
using (cared_user_id = (select auth.uid()));

drop policy if exists "participants view alerts when enabled" on public.care_alerts;
drop policy if exists "participants update alerts when enabled" on public.care_alerts;
create policy "participants view alerts when enabled" on public.care_alerts for select to authenticated
using ((select private.care_scope_enabled(cared_user_id, 'alerts')));
create policy "participants update alerts when enabled" on public.care_alerts for update to authenticated
using ((select private.care_scope_enabled(cared_user_id, 'alerts')))
with check ((select private.care_scope_enabled(cared_user_id, 'alerts')));

drop policy if exists "participants manage checkins" on public.care_checkins;
create policy "participants manage checkins" on public.care_checkins for all to authenticated
using (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id)) and (select private.care_scope_enabled(cared_user_id, 'checkins')))
)
with check (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id)) and (select private.care_scope_enabled(cared_user_id, 'checkins')))
);
drop policy if exists "participants manage appointments" on public.care_appointments;
create policy "participants manage appointments" on public.care_appointments for all to authenticated
using (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id)) and (select private.care_scope_enabled(cared_user_id, 'agenda')))
)
with check (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id)) and (select private.care_scope_enabled(cared_user_id, 'agenda')))
);
drop policy if exists "participants manage plans" on public.care_plans;
create policy "participants manage plans" on public.care_plans for all to authenticated
using ((select private.care_scope_enabled(cared_user_id, 'care_plan')))
with check ((select private.care_scope_enabled(cared_user_id, 'care_plan')));
drop policy if exists "participants manage care team" on public.care_team_members;
create policy "participants manage care team" on public.care_team_members for all to authenticated
using ((select private.care_scope_enabled(cared_user_id, 'care_plan')))
with check ((select private.care_scope_enabled(cared_user_id, 'care_plan')));
drop policy if exists "caregiver owns private notes" on public.caregiver_notes;
create policy "caregiver owns private notes" on public.caregiver_notes for all to authenticated
using (
  caregiver_user_id = (select auth.uid())
  and (select private.care_link_for(cared_user_id)) is not null
)
with check (
  caregiver_user_id = (select auth.uid())
  and (select private.care_link_for(cared_user_id)) is not null
);
drop policy if exists "participants manage support actions" on public.care_support_actions;
create policy "participants manage support actions" on public.care_support_actions for all to authenticated
using (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id)) and (select private.care_scope_enabled(cared_user_id, 'support_actions')))
)
with check (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id)) and (select private.care_scope_enabled(cared_user_id, 'support_actions')))
);
drop policy if exists "participants view audit log" on public.care_audit_log;
create policy "participants view audit log" on public.care_audit_log for select to authenticated
using ((select private.care_scope_enabled(cared_user_id, 'audit')));

-- A role cuidador não recebe eventos emocionais individuais. A única leitura
-- compartilhável é a RPC agregada e consentida acima.
drop policy if exists emotion_events_select_owner_or_caregiver on public.emotion_events;
drop policy if exists emotion_events_select_owner on public.emotion_events;
create policy emotion_events_select_owner on public.emotion_events for select to authenticated
using (user_id = (select auth.uid()));

-- Vínculos aceitos são criados exclusivamente pela função de aceite; isso
-- impede que um cuidador construa um vínculo para outra pessoa por INSERT.
drop policy if exists caregiver_links_select_party on public.caregiver_links;
drop policy if exists caregiver_links_insert_as_caregiver on public.caregiver_links;
drop policy if exists caregiver_links_delete_party on public.caregiver_links;
create policy caregiver_links_select_party on public.caregiver_links for select to authenticated
using (caregiver_user_id = (select auth.uid()) or cared_user_id = (select auth.uid()));
create policy caregiver_links_insert_as_caregiver on public.caregiver_links for insert to authenticated
with check (
  caregiver_user_id = (select auth.uid())
  and status = 'pending'
  and cared_user_id is null
  and accepted_at is null
);
create policy caregiver_links_delete_party on public.caregiver_links for delete to authenticated
using (caregiver_user_id = (select auth.uid()) or cared_user_id = (select auth.uid()));

create or replace function public.accept_invite(code text)
returns public.caregiver_links
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  link public.caregiver_links;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  select * into link from public.caregiver_links where invite_code = code for update;
  if link is null then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  if link.status = 'accepted' then raise exception 'invite_already_accepted' using errcode = '23505'; end if;
  if link.revoked_at is not null then raise exception 'invite_revoked' using errcode = '22023'; end if;
  if link.expires_at is not null and link.expires_at <= now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  if link.caregiver_user_id = auth.uid() then raise exception 'cannot_accept_own_invite' using errcode = '22023'; end if;
  update public.caregiver_links
  set cared_user_id = auth.uid(), status = 'accepted', accepted_at = now()
  where id = link.id
  returning * into link;
  return link;
end;
$$;

revoke all on function private.touch_care_updated_at() from public, anon, authenticated;
revoke all on function private.care_link_for(uuid) from public, anon, authenticated;
revoke all on function private.care_scope_enabled(uuid, text) from public, anon, authenticated;
revoke all on function private.create_persistent_signal_alert() from public, anon, authenticated;
revoke all on function private.enforce_care_actor_integrity() from public, anon, authenticated;
revoke all on function private.enforce_care_alert_transition() from public, anon, authenticated;
grant execute on function private.care_link_for(uuid) to authenticated;
grant execute on function private.care_scope_enabled(uuid, text) to authenticated;
revoke all on function public.care_dashboard_summary(uuid, integer) from public, anon;
grant execute on function public.care_dashboard_summary(uuid, integer) to authenticated;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
revoke all on function public.bump_profile(integer, integer, integer) from public, anon;
grant execute on function public.bump_profile(integer, integer, integer) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
