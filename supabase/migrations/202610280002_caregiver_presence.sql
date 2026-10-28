-- Cuidado como presença, não vigilância.
--
-- 1. Pausar o compartilhamento (24 h / 7 dias) sem encerrar o vínculo.
-- 2. Tendência por humor: o resumo diário traz agradável / neutro / difícil.
-- 3. Retorno do cuidador sobre o alerta (útil, falso alarme, já sabia) e
--    limiar por vínculo: falsos alarmes repetidos deixam o alerta mais exigente.
-- 4. Carinho mediado pelo pet: o cuidador manda um gesto; quem entrega é o pet.
-- 5. "Preciso de você": a pessoa acompanhada pede contato, com urgência.
-- 6. Tokens de push (avisos com texto neutro; o conteúdo fica no app).

-- ── 1. pausa ───────────────────────────────────────────────────────────────
alter table public.caregiver_links add column if not exists paused_until timestamptz;

create or replace function private.care_link_for(p_cared_user_id uuid)
returns uuid
language sql stable security definer set search_path = pg_catalog
as $$
  select l.id
  from public.caregiver_links l
  where l.caregiver_user_id = (select auth.uid())
    and l.cared_user_id = p_cared_user_id
    and l.status = 'accepted'
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
    and (l.paused_until is null or l.paused_until <= now())
  limit 1;
$$;

create or replace function private.care_scope_enabled(p_cared_user_id uuid, p_scope text)
returns boolean
language sql stable security definer set search_path = pg_catalog
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
        -- Pausado: o cuidador vê só "compartilhamento pausado".
        and (l.paused_until is null or l.paused_until <= now())
    );
$$;

-- Só a pessoa acompanhada pausa (24 h ou 7 dias) ou retoma (0).
create or replace function public.pause_care_sharing(p_link uuid, p_hours integer)
returns timestamptz
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_until timestamptz;
begin
  if p_hours not in (0, 24, 168) then raise exception 'invalid_pause' using errcode = '22023'; end if;
  v_until := case when p_hours = 0 then null else now() + make_interval(hours => p_hours) end;
  update public.caregiver_links
     set paused_until = v_until
   where id = p_link and cared_user_id = auth.uid() and status = 'accepted' and revoked_at is null;
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  return v_until;
end $$;
revoke all on function public.pause_care_sharing(uuid, integer) from public, anon;
grant execute on function public.pause_care_sharing(uuid, integer) to authenticated;

-- ── 2. tendência por humor ─────────────────────────────────────────────────
create or replace function public.care_dashboard_summary(p_cared_user_id uuid, p_hours integer default 168)
returns jsonb
language plpgsql security definer set search_path = pg_catalog
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
    select date_trunc('hour', created_at) as bucket, emotion, count(*)::int as count from filtered group by 1, 2
  ),
  hourly_ranked as (
    select *, row_number() over (partition by bucket order by count desc, emotion) as rn from hourly_counts
  ),
  hourly as (
    select bucket, sum(count)::int as count, max(emotion) filter (where rn = 1) as dominant
    from hourly_ranked group by bucket order by bucket
  ),
  -- Por dia: volume E como foi (agradável / neutro / difícil). Um dia sem uso
  -- e um dia difícil deixam de parecer iguais no gráfico.
  daily_counts as (
    select date_trunc('day', created_at) as bucket, emotion, count(*)::int as count from filtered group by 1, 2
  ),
  daily_ranked as (
    select *, row_number() over (partition by bucket order by count desc, emotion) as rn from daily_counts
  ),
  daily as (
    select bucket,
           sum(count)::int as count,
           max(emotion) filter (where rn = 1) as dominant,
           coalesce(sum(count) filter (where emotion = 'happy'), 0)::int as pleasant,
           coalesce(sum(count) filter (where emotion in ('neutral', 'surprised')), 0)::int as neutral,
           coalesce(sum(count) filter (where emotion in ('sad', 'angry', 'disgusted', 'fearful')), 0)::int as difficult
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
    'daily', coalesce((select jsonb_agg(jsonb_build_object('at', bucket, 'count', count, 'dominant', dominant,
                                                           'pleasant', pleasant, 'neutral', neutral, 'difficult', difficult)) from daily), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'count', count)) from sources), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ── 3. retorno sobre alertas e limiar por vínculo ──────────────────────────
alter table public.care_alerts add column if not exists feedback text
  check (feedback is null or feedback in ('useful', 'false_alarm', 'already_knew'));
alter table public.care_alerts add column if not exists feedback_at timestamptz;

create or replace function private.create_persistent_signal_alert()
returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_link record;
  v_required integer;
  v_difficult integer;
  v_false integer;
  v_useful integer;
begin
  if new.emotion not in ('sad', 'angry', 'disgusted', 'fearful') then
    return new;
  end if;

  for v_link in
    select l.id
    from public.caregiver_links l
    where l.cared_user_id = new.user_id
      and l.status = 'accepted'
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
      and (l.paused_until is null or l.paused_until <= now())
  loop
    -- Falsos alarmes recentes (mais que os úteis) deixam o vínculo mais
    -- exigente: 4 leituras difíceis em 2 h em vez de 3 em 90 min.
    select count(*) filter (where feedback = 'false_alarm'), count(*) filter (where feedback = 'useful')
      into v_false, v_useful
      from public.care_alerts
     where caregiver_link_id = v_link.id and feedback_at > now() - interval '30 days';
    v_required := case when v_false >= 3 and v_false > v_useful then 4 else 3 end;

    select count(*) into v_difficult
    from (
      select emotion from public.emotion_events
      where user_id = new.user_id
        and created_at >= new.created_at - (case when v_required = 4 then interval '120 minutes' else interval '90 minutes' end)
      order by created_at desc
      limit v_required
    ) recent
    where emotion in ('sad', 'angry', 'disgusted', 'fearful');

    if v_difficult >= v_required and not exists (
      select 1 from public.care_alerts a
      where a.caregiver_link_id = v_link.id
        and a.kind = 'persistent_difficult_signal'
        and a.status in ('open', 'acknowledged')
        and a.occurred_at > new.created_at - interval '6 hours'
    ) then
      insert into public.care_alerts (cared_user_id, caregiver_link_id, kind, severity, title, detail, evidence)
      values (
        new.user_id, v_link.id, 'persistent_difficult_signal', 'attention',
        'Sinal persistente para acompanhar',
        'Foram registradas leituras difíceis repetidas. Isso não é um diagnóstico; priorize um check-in respeitoso.',
        jsonb_build_object('readings', v_difficult, 'required', v_required, 'latest_emotion', new.emotion)
      );
    end if;
  end loop;
  return new;
end;
$$;

-- O gatilho de transição passa a aceitar uma atualização que mude SÓ o
-- retorno (feedback): todo o resto continua imutável.
create or replace function private.enforce_care_alert_transition()
returns trigger
language plpgsql security definer set search_path = pg_catalog
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

  if new.status = old.status
    and new.acknowledged_by is not distinct from old.acknowledged_by
    and new.acknowledged_at is not distinct from old.acknowledged_at
    and new.resolved_by is not distinct from old.resolved_by
    and new.resolved_at is not distinct from old.resolved_at
    and new.feedback is distinct from old.feedback
    and new.feedback_at is not null then
    return new;
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

-- Retorno do cuidador. A transição de status continua protegida pelo
-- gatilho; o retorno é gravado à parte, só pelo cuidador daquele vínculo.
create or replace function public.give_alert_feedback(p_alert uuid, p_feedback text)
returns void
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if p_feedback not in ('useful', 'false_alarm', 'already_knew') then
    raise exception 'invalid_feedback' using errcode = '22023';
  end if;
  update public.care_alerts a
     set feedback = p_feedback, feedback_at = now()
   where a.id = p_alert
     and a.caregiver_link_id = private.care_link_for(a.cared_user_id);
  if not found then raise exception 'alert_not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.give_alert_feedback(uuid, text) from public, anon;
grant execute on function public.give_alert_feedback(uuid, text) to authenticated;

-- ── 4. carinho mediado pelo pet ────────────────────────────────────────────
create table if not exists public.care_gestures (
  id uuid primary key default gen_random_uuid(),
  caregiver_link_id uuid not null references public.caregiver_links(id) on delete cascade,
  caregiver_user_id uuid not null references auth.users(id) on delete cascade,
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('pensando', 'abraco', 'perto')),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists care_gestures_cared_idx on public.care_gestures (cared_user_id, created_at desc);
alter table public.care_gestures enable row level security;
revoke all on public.care_gestures from public, anon;
grant select, insert, update on public.care_gestures to authenticated;

drop policy if exists care_gestures_send on public.care_gestures;
create policy care_gestures_send on public.care_gestures for insert to authenticated
with check (
  caregiver_user_id = (select auth.uid())
  and caregiver_link_id = (select private.care_link_for(cared_user_id))
);
drop policy if exists care_gestures_read on public.care_gestures;
create policy care_gestures_read on public.care_gestures for select to authenticated
using (cared_user_id = (select auth.uid()) or caregiver_user_id = (select auth.uid()));
drop policy if exists care_gestures_seen on public.care_gestures;
create policy care_gestures_seen on public.care_gestures for update to authenticated
using (cared_user_id = (select auth.uid()))
with check (cared_user_id = (select auth.uid()));

-- Carinho, não enxurrada: no máximo 6 gestos por dia por vínculo.
create or replace function private.limit_care_gestures()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if (select count(*) from public.care_gestures g
      where g.caregiver_link_id = new.caregiver_link_id and g.created_at > now() - interval '1 day') >= 6 then
    raise exception 'gesture_limit' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists care_gestures_limit on public.care_gestures;
create trigger care_gestures_limit before insert on public.care_gestures
for each row execute function private.limit_care_gestures();

-- ── 5. "preciso de você" ───────────────────────────────────────────────────
create table if not exists public.care_requests (
  id uuid primary key default gen_random_uuid(),
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  urgency text not null check (urgency in ('quando_puder', 'hoje', 'agora')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id)
);
create index if not exists care_requests_cared_idx on public.care_requests (cared_user_id, created_at desc);
alter table public.care_requests enable row level security;
revoke all on public.care_requests from public, anon;
grant select, insert, update on public.care_requests to authenticated;

drop policy if exists care_requests_ask on public.care_requests;
create policy care_requests_ask on public.care_requests for insert to authenticated
with check (
  cared_user_id = (select auth.uid())
  and exists (select 1 from public.caregiver_links l
              where l.cared_user_id = (select auth.uid()) and l.status = 'accepted' and l.revoked_at is null)
);
drop policy if exists care_requests_read on public.care_requests;
create policy care_requests_read on public.care_requests for select to authenticated
using (cared_user_id = (select auth.uid()) or (select private.care_link_for(cared_user_id)) is not null);
drop policy if exists care_requests_ack on public.care_requests;
create policy care_requests_ack on public.care_requests for update to authenticated
using ((select private.care_link_for(cared_user_id)) is not null)
with check ((select private.care_link_for(cared_user_id)) is not null and acknowledged_by = (select auth.uid()));

create or replace function private.limit_care_requests()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if (select count(*) from public.care_requests r
      where r.cared_user_id = new.cared_user_id and r.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'request_limit' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists care_requests_limit on public.care_requests;
create trigger care_requests_limit before insert on public.care_requests
for each row execute function private.limit_care_requests();

-- ── 6. tokens de push ──────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon;
grant select, insert, update, delete on public.push_tokens to authenticated;
drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
