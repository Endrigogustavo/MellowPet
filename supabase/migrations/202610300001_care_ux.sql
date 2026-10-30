-- Nova área do cuidador (docs/ux/plano.md §4). Só aditiva: nenhuma tabela ou
-- coluna é apagada e nenhum dado é perdido. Pode rodar mais de uma vez.
--
-- 1. Anotações por dia: caregiver_notes ganha note_day, caregiver_link_id e
--    author_id; o autor edita e apaga enquanto o vínculo está ativo.
-- 2. Preferências de push por vínculo (care_notification_prefs).
-- 3. Regras de alerta por vínculo (care_alert_rules), usadas pelo gatilho de
--    alerta. Sem regra, vale o comportamento anterior (inclusive o ajuste por
--    falso alarme).
-- 4. Histórico dia/semana/mês em data local (RPC care_history).
-- 5. Registro do termo aceito (care_consents + accept_invite_with_consent).
-- 6. "Preciso de você" chega ao cuidador mesmo com o compartilhamento pausado;
--    o cuidador só confirma o pedido, não reescreve o resto.
-- 7. Correções da auditoria: gestos só com vínculo ativo, auditoria só do
--    próprio cuidador, validade do convite e pausa com NULL.
--
-- Contratos do app: app/src/care/careUxTypes.ts.

-- ── helpers ────────────────────────────────────────────────────────────────
-- Vínculo aceito, não revogado e não expirado, MESMO pausado. Usado só onde a
-- pausa não deve calar a pessoa (pedidos "preciso de você").
create or replace function private.care_link_even_paused(p_cared_user_id uuid)
returns uuid
language sql stable security definer set search_path = ''
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

-- O vínculo é do cuidador autenticado (aceito e não revogado; pausado vale:
-- o cuidador pode ajustar as próprias preferências durante a pausa).
create or replace function private.is_own_care_link(p_link uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.caregiver_links l
    where l.id = p_link
      and l.caregiver_user_id = (select auth.uid())
      and l.status = 'accepted'
      and l.revoked_at is null
  );
$$;

revoke all on function private.care_link_even_paused(uuid) from public, anon, authenticated;
revoke all on function private.is_own_care_link(uuid) from public, anon, authenticated;
grant execute on function private.care_link_even_paused(uuid) to authenticated;
grant execute on function private.is_own_care_link(uuid) to authenticated;

-- ── 1. anotações por dia ───────────────────────────────────────────────────
-- note_day e caregiver_link_id entram com preenchimento das notas antigas
-- (dia local de created_at; vínculo do mesmo par cuidador/pessoa). Os
-- gatilhos da tabela exigem auth.uid() e ficam desligados só durante esse
-- preenchimento, dentro do mesmo bloco.
do $$
declare
  v_add_day boolean := not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'caregiver_notes' and column_name = 'note_day'
  );
  v_add_link boolean := not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'caregiver_notes' and column_name = 'caregiver_link_id'
  );
begin
  if v_add_day then
    alter table public.caregiver_notes add column note_day date;
  end if;
  if v_add_link then
    alter table public.caregiver_notes
      add column caregiver_link_id uuid references public.caregiver_links(id) on delete set null;
  end if;

  if v_add_day or v_add_link then
    alter table public.caregiver_notes disable trigger user;
    if v_add_day then
      update public.caregiver_notes
         set note_day = (created_at at time zone 'America/Sao_Paulo')::date;
    end if;
    if v_add_link then
      update public.caregiver_notes n
         set caregiver_link_id = (
           select l.id
           from public.caregiver_links l
           where l.caregiver_user_id = n.caregiver_user_id
             and l.cared_user_id = n.cared_user_id
             and l.status = 'accepted'
           order by (l.revoked_at is null) desc, l.accepted_at desc nulls last
           limit 1
         );
    end if;
    alter table public.caregiver_notes enable trigger user;
  end if;
end $$;

-- Mesma forma do plano §4 (se a coluna acabou de ser criada acima, isto só
-- fixa o padrão e o NOT NULL; se já existia, não muda nada).
alter table public.caregiver_notes
  add column if not exists note_day date not null default ((now() at time zone 'America/Sao_Paulo')::date);
alter table public.caregiver_notes
  alter column note_day set default ((now() at time zone 'America/Sao_Paulo')::date);
alter table public.caregiver_notes alter column note_day set not null;
-- updated_at já existe desde a fundação (not null, default now()); a nota foi
-- editada quando updated_at > created_at.
alter table public.caregiver_notes add column if not exists updated_at timestamptz not null default now();
-- author_id é o nome do contrato do app (CareNote.author_id); espelha
-- caregiver_user_id e não aceita valor do cliente.
alter table public.caregiver_notes
  add column if not exists author_id uuid generated always as (caregiver_user_id) stored;

-- Texto da nota entre 1 e 2000 caracteres. NOT VALID: não revalida notas antigas.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'caregiver_notes_body_length' and conrelid = 'public.caregiver_notes'::regclass
  ) then
    alter table public.caregiver_notes
      add constraint caregiver_notes_body_length
      check (char_length(btrim(body)) between 1 and 2000) not valid;
  end if;
end $$;

create index if not exists caregiver_notes_author_day_idx
  on public.caregiver_notes (caregiver_user_id, cared_user_id, note_day desc);
create index if not exists caregiver_notes_link_idx
  on public.caregiver_notes (caregiver_link_id);

-- Vínculo vem do servidor (nunca do cliente) e não muda depois; o dia não
-- pode ser no futuro (até amanhã, por fuso) nem absurdo no passado.
create or replace function private.caregiver_note_defaults()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if tg_op = 'INSERT' then
    new.caregiver_link_id := private.care_link_for(new.cared_user_id);
  else
    new.caregiver_link_id := old.caregiver_link_id;
  end if;
  if new.note_day is null then
    new.note_day := v_today;
  end if;
  if new.note_day > v_today + 1 or new.note_day < date '2020-01-01' then
    raise exception 'invalid_note_day' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function private.caregiver_note_defaults() from public, anon, authenticated;

drop trigger if exists caregiver_notes_link_day on public.caregiver_notes;
create trigger caregiver_notes_link_day before insert or update on public.caregiver_notes
for each row execute function private.caregiver_note_defaults();

-- A policy "for all" da fundação vira quatro policies equivalentes e
-- explícitas: só o autor, só com vínculo ativo (não pausado, não revogado).
drop policy if exists "caregiver owns private notes" on public.caregiver_notes;
drop policy if exists caregiver_notes_select_author on public.caregiver_notes;
drop policy if exists caregiver_notes_insert_author on public.caregiver_notes;
drop policy if exists caregiver_notes_update_author on public.caregiver_notes;
drop policy if exists caregiver_notes_delete_author on public.caregiver_notes;
create policy caregiver_notes_select_author on public.caregiver_notes for select to authenticated
using (caregiver_user_id = (select auth.uid()) and (select private.care_link_for(cared_user_id)) is not null);
create policy caregiver_notes_insert_author on public.caregiver_notes for insert to authenticated
with check (caregiver_user_id = (select auth.uid()) and (select private.care_link_for(cared_user_id)) is not null);
create policy caregiver_notes_update_author on public.caregiver_notes for update to authenticated
using (caregiver_user_id = (select auth.uid()) and (select private.care_link_for(cared_user_id)) is not null)
with check (caregiver_user_id = (select auth.uid()) and (select private.care_link_for(cared_user_id)) is not null);
create policy caregiver_notes_delete_author on public.caregiver_notes for delete to authenticated
using (caregiver_user_id = (select auth.uid()) and (select private.care_link_for(cared_user_id)) is not null);
grant select, insert, update, delete on public.caregiver_notes to authenticated;

-- ── 2. preferências de notificação ─────────────────────────────────────────
-- Uma linha por vínculo. Sem linha, a Edge Function care-push usa os mesmos
-- padrões do app (DEFAULT_NOTIFICATION_PREFS): tudo ligado, silêncio 22h–7h.
-- Horários em America/Sao_Paulo. Pedido "agora" fura o silêncio.
create table if not exists public.care_notification_prefs (
  caregiver_link_id uuid primary key references public.caregiver_links(id) on delete cascade,
  push_alerts boolean not null default true,
  push_requests boolean not null default true,
  weekly_digest boolean not null default true,
  quiet_start time default '22:00',
  quiet_end time default '07:00',
  updated_at timestamptz not null default now(),
  -- Os dois horários juntos ou nenhum: meio silêncio não tem significado.
  constraint care_notification_prefs_quiet_pair check ((quiet_start is null) = (quiet_end is null))
);
alter table public.care_notification_prefs enable row level security;
revoke all on public.care_notification_prefs from public, anon;
grant select, insert, update, delete on public.care_notification_prefs to authenticated;

drop trigger if exists care_notification_prefs_touch_updated_at on public.care_notification_prefs;
create trigger care_notification_prefs_touch_updated_at before update on public.care_notification_prefs
for each row execute function private.touch_care_updated_at();

drop policy if exists care_notification_prefs_owner on public.care_notification_prefs;
create policy care_notification_prefs_owner on public.care_notification_prefs for all to authenticated
using ((select private.is_own_care_link(caregiver_link_id)))
with check ((select private.is_own_care_link(caregiver_link_id)));

-- ── 3. regras de alerta ────────────────────────────────────────────────────
-- Faixas largas o bastante para ajustar, estreitas o bastante para não virar
-- vigilância (nada de "1 leitura em 5 minutos").
create table if not exists public.care_alert_rules (
  caregiver_link_id uuid primary key references public.caregiver_links(id) on delete cascade,
  enabled boolean not null default true,
  min_readings integer not null default 3 check (min_readings between 2 and 10),
  window_minutes integer not null default 90 check (window_minutes between 30 and 360),
  emotions text[] not null default array['sad', 'angry', 'fearful', 'disgusted']::text[]
    check (
      cardinality(emotions) between 1 and 4
      and emotions <@ array['sad', 'angry', 'fearful', 'disgusted']::text[]
    ),
  updated_at timestamptz not null default now()
);
alter table public.care_alert_rules enable row level security;
revoke all on public.care_alert_rules from public, anon;
grant select, insert, update, delete on public.care_alert_rules to authenticated;

drop trigger if exists care_alert_rules_touch_updated_at on public.care_alert_rules;
create trigger care_alert_rules_touch_updated_at before update on public.care_alert_rules
for each row execute function private.touch_care_updated_at();

drop policy if exists care_alert_rules_owner on public.care_alert_rules;
create policy care_alert_rules_owner on public.care_alert_rules for all to authenticated
using ((select private.is_own_care_link(caregiver_link_id)))
with check ((select private.is_own_care_link(caregiver_link_id)));

-- O gatilho passa a ler a regra do vínculo. Sem regra: 3 leituras difíceis em
-- 90 min, ou 4 em 120 min quando há falsos alarmes demais (como antes). Regra
-- desligada: nenhum alerta para aquele vínculo. Leituras feitas durante uma
-- pausa não contam depois que ela acaba.
create or replace function private.create_persistent_signal_alert()
returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  c_difficult constant text[] := array['sad', 'angry', 'disgusted', 'fearful']::text[];
  v_link record;
  v_required integer;
  v_window_minutes integer;
  v_emotions text[];
  v_difficult integer;
  v_false integer;
  v_useful integer;
begin
  if new.emotion not in ('sad', 'angry', 'disgusted', 'fearful') then
    return new;
  end if;

  for v_link in
    select l.id, l.paused_until,
           r.enabled as rule_enabled, r.min_readings, r.window_minutes, r.emotions
    from public.caregiver_links l
    left join public.care_alert_rules r on r.caregiver_link_id = l.id
    where l.cared_user_id = new.user_id
      and l.status = 'accepted'
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
      and (l.paused_until is null or l.paused_until <= now())
  loop
    if v_link.rule_enabled is null then
      -- Sem regra: comportamento anterior, com ajuste por falso alarme.
      select count(*) filter (where a.feedback = 'false_alarm'), count(*) filter (where a.feedback = 'useful')
        into v_false, v_useful
        from public.care_alerts a
       where a.caregiver_link_id = v_link.id and a.feedback_at > now() - interval '30 days';
      v_required := case when v_false >= 3 and v_false > v_useful then 4 else 3 end;
      v_window_minutes := case when v_required = 4 then 120 else 90 end;
      v_emotions := c_difficult;
    elsif v_link.rule_enabled then
      v_required := v_link.min_readings;
      v_window_minutes := v_link.window_minutes;
      v_emotions := v_link.emotions;
    else
      continue;
    end if;

    if not (new.emotion = any (v_emotions)) then
      continue;
    end if;

    select count(*) into v_difficult
    from (
      select e.emotion
      from public.emotion_events e
      where e.user_id = new.user_id
        and e.created_at >= new.created_at - make_interval(mins => v_window_minutes)
        and e.created_at > coalesce(v_link.paused_until, '-infinity'::timestamptz)
      order by e.created_at desc
      limit v_required
    ) recent
    where recent.emotion = any (v_emotions);

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
        jsonb_build_object(
          'readings', v_difficult,
          'required', v_required,
          'window_minutes', v_window_minutes,
          'custom_rule', v_link.rule_enabled is not null,
          'latest_emotion', new.emotion
        )
      );
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.create_persistent_signal_alert() from public, anon, authenticated;

-- ── 4. histórico dia / semana / mês ────────────────────────────────────────
-- Buckets em data LOCAL (o care_dashboard_summary usa UTC). Semana começa na
-- segunda (ISO). Períodos sem leitura voltam com zeros, para o gráfico não
-- pular dias. top_emotion ignora "unknown" (leitura sem rosto claro); o total
-- conta tudo. Limites: dia até 31, semana até 12, mês até 6 períodos.
create or replace function public.care_history(
  p_cared uuid,
  p_granularity text,
  p_periods integer,
  p_tz text default 'America/Sao_Paulo'
)
returns table (bucket date, total integer, pleasant integer, neutral integer, difficult integer, top_emotion text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tz text := coalesce(p_tz, 'America/Sao_Paulo');
  v_periods integer;
  v_step interval;
  v_today date;
  v_current date;
  v_first date;
  v_since timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  -- A própria pessoa ou um cuidador com vínculo ativo (não pausado).
  if p_cared is null
     or ((select auth.uid()) <> p_cared and private.care_link_for(p_cared) is null) then
    raise exception 'care_scope_denied' using errcode = '42501';
  end if;
  if p_granularity is null or p_granularity not in ('day', 'week', 'month') then
    raise exception 'invalid_granularity' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  v_periods := greatest(1, least(
    coalesce(p_periods, case p_granularity when 'day' then 14 when 'week' then 12 else 6 end),
    case p_granularity when 'day' then 31 when 'week' then 12 else 6 end
  ));
  v_step := case p_granularity
    when 'day' then interval '1 day'
    when 'week' then interval '7 days'
    else interval '1 month'
  end;
  v_today := (now() at time zone v_tz)::date;
  v_current := case p_granularity
    when 'day' then v_today
    when 'week' then pg_catalog.date_trunc('week', v_today::timestamp)::date
    else pg_catalog.date_trunc('month', v_today::timestamp)::date
  end;
  v_first := (v_current::timestamp - (v_periods - 1) * v_step)::date;
  v_since := v_first::timestamp at time zone v_tz;

  return query
  with series as (
    select gs::date as b
    from pg_catalog.generate_series(v_first::timestamp, v_current::timestamp, v_step) as gs
  ),
  ev as (
    select
      case p_granularity
        when 'day' then x.d
        when 'week' then pg_catalog.date_trunc('week', x.d::timestamp)::date
        else pg_catalog.date_trunc('month', x.d::timestamp)::date
      end as b,
      x.emotion
    from (
      select (e.created_at at time zone v_tz)::date as d, e.emotion
      from public.emotion_events e
      where e.user_id = p_cared and e.created_at >= v_since
    ) x
  ),
  counts as (
    select ev.b, ev.emotion, count(*)::integer as n
    from ev
    group by ev.b, ev.emotion
  ),
  agg as (
    select c.b,
           sum(c.n)::integer as n_total,
           coalesce(sum(c.n) filter (where c.emotion = 'happy'), 0)::integer as n_pleasant,
           coalesce(sum(c.n) filter (where c.emotion in ('neutral', 'surprised')), 0)::integer as n_neutral,
           coalesce(sum(c.n) filter (where c.emotion in ('sad', 'angry', 'disgusted', 'fearful')), 0)::integer as n_difficult
    from counts c
    group by c.b
  ),
  ranked as (
    select c.b, c.emotion,
           row_number() over (partition by c.b order by c.n desc, c.emotion) as rn
    from counts c
    where c.emotion is not null and c.emotion <> 'unknown'
  )
  select s.b,
         coalesce(a.n_total, 0),
         coalesce(a.n_pleasant, 0),
         coalesce(a.n_neutral, 0),
         coalesce(a.n_difficult, 0),
         r.emotion
  from series s
  left join agg a on a.b = s.b
  left join ranked r on r.b = s.b and r.rn = 1
  order by s.b;
end;
$$;
revoke all on function public.care_history(uuid, text, integer, text) from public, anon;
grant execute on function public.care_history(uuid, text, integer, text) to authenticated;

-- ── 5. termo aceito (LGPD) ─────────────────────────────────────────────────
-- Uma linha por aceite, com a versão do termo que a pessoa viu na prévia.
-- Só a RPC grava; ninguém edita nem apaga pelo app.
create table if not exists public.care_consents (
  id uuid primary key default gen_random_uuid(),
  caregiver_link_id uuid not null references public.caregiver_links(id) on delete cascade,
  cared_user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (terms_version ~ '^[0-9A-Za-z._-]{1,32}$'),
  accepted_at timestamptz not null default now()
);
create index if not exists care_consents_link_idx on public.care_consents (caregiver_link_id, accepted_at desc);
create index if not exists care_consents_cared_idx on public.care_consents (cared_user_id, accepted_at desc);
alter table public.care_consents enable row level security;
revoke all on public.care_consents from public, anon, authenticated;
grant select on public.care_consents to authenticated;

drop policy if exists care_consents_read_party on public.care_consents;
create policy care_consents_read_party on public.care_consents for select to authenticated
using (
  cared_user_id = (select auth.uid())
  or exists (
    select 1 from public.caregiver_links l
    where l.id = care_consents.caregiver_link_id and l.caregiver_user_id = (select auth.uid())
  )
);

-- Mesmo contrato do accept_invite (202610290001): devolve o vínculo em JSONB
-- ou {error, code} sem raise, para a tentativa que falha continuar contada
-- em private.invite_attempts. A versão do termo é validada antes (não gasta
-- tentativa) e o registro do aceite vai junto com o vínculo.
create or replace function public.accept_invite_with_consent(p_code text, p_terms_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms text := btrim(coalesce(p_terms_version, ''));
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if v_terms !~ '^[0-9A-Za-z._-]{1,32}$' then
    return jsonb_build_object('error', 'invalid_terms_version', 'code', '22023');
  end if;

  v_result := public.accept_invite(p_code);
  if v_result is null or v_result ? 'error' then
    return v_result;
  end if;

  insert into public.care_consents (caregiver_link_id, cared_user_id, terms_version)
  values ((v_result ->> 'id')::uuid, auth.uid(), v_terms);
  return v_result;
end;
$$;
revoke all on function public.accept_invite_with_consent(text, text) from public, anon;
grant execute on function public.accept_invite_with_consent(text, text) to authenticated;

-- ── 6. "preciso de você" durante a pausa ───────────────────────────────────
-- Decisão de produto (plano §2): pausa esconde DADOS, não a voz da pessoa.
-- O cuidador de vínculo aceito e não revogado vê e confirma o pedido mesmo
-- com o compartilhamento pausado.
drop policy if exists care_requests_read on public.care_requests;
create policy care_requests_read on public.care_requests for select to authenticated
using (
  cared_user_id = (select auth.uid())
  or (select private.care_link_even_paused(cared_user_id)) is not null
);
drop policy if exists care_requests_ack on public.care_requests;
create policy care_requests_ack on public.care_requests for update to authenticated
using ((select private.care_link_even_paused(cared_user_id)) is not null)
with check (
  (select private.care_link_even_paused(cared_user_id)) is not null
  and acknowledged_by = (select auth.uid())
);

-- O cuidador só confirma: UPDATE por coluna e um gatilho que fixa quem e
-- quando confirmou. Urgência, pessoa e data ficam imutáveis.
revoke update on public.care_requests from authenticated;
grant update (acknowledged_at, acknowledged_by) on public.care_requests to authenticated;

create or replace function private.enforce_care_request_ack()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Manutenção pelo painel/service_role não passa por aqui.
  if auth.uid() is null then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.cared_user_id is distinct from old.cared_user_id
     or new.urgency is distinct from old.urgency
     or new.created_at is distinct from old.created_at then
    raise exception 'care_request_immutable' using errcode = '42501';
  end if;
  -- Já confirmado (por este ou outro cuidador): ignora a linha sem erro e
  -- mantém a primeira confirmação.
  if old.acknowledged_at is not null then
    return null;
  end if;
  if new.acknowledged_at is null then
    raise exception 'care_request_invalid_ack' using errcode = '22023';
  end if;
  new.acknowledged_at := now();
  new.acknowledged_by := auth.uid();
  return new;
end $$;
revoke all on function private.enforce_care_request_ack() from public, anon, authenticated;

drop trigger if exists care_requests_enforce_ack on public.care_requests;
create trigger care_requests_enforce_ack before update on public.care_requests
for each row execute function private.enforce_care_request_ack();

-- ── 7. correções da auditoria ──────────────────────────────────────────────
-- 7a. Gestos: o cuidador só lê os gestos que mandou enquanto o vínculo está
-- ativo (seen_at revelava quando a pessoa abriu o app durante a pausa ou
-- depois de revogar). A pessoa acompanhada só marca seen_at.
drop policy if exists care_gestures_read on public.care_gestures;
create policy care_gestures_read on public.care_gestures for select to authenticated
using (
  cared_user_id = (select auth.uid())
  or (
    caregiver_user_id = (select auth.uid())
    and caregiver_link_id = (select private.care_link_for(cared_user_id))
  )
);
revoke update on public.care_gestures from authenticated;
grant update (seen_at) on public.care_gestures to authenticated;

-- 7b. Auditoria: a pessoa vê toda a trilha dela; o cuidador vê só o que ele
-- fez ou o que é do vínculo dele, e só com o vínculo ativo.
drop policy if exists "participants view audit log" on public.care_audit_log;
create policy "participants view audit log" on public.care_audit_log for select to authenticated
using (
  cared_user_id = (select auth.uid())
  or (
    (select private.care_link_for(cared_user_id)) is not null
    and (
      actor_user_id = (select auth.uid())
      or caregiver_link_id = (select private.care_link_for(cared_user_id))
    )
  )
);

-- 7c. Tentativas de aceite que falham: já contam desde 202610290001
-- (accept_invite devolve {error} sem raise, e o INSERT em
-- private.invite_attempts não é desfeito). accept_invite_with_consent acima
-- segue o mesmo padrão.

-- 7d. Convite: o cliente não estende a validade além de 72 h.
create or replace function private.default_invite_expiry()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'pending' then
    new.expires_at := least(
      coalesce(new.expires_at, now() + interval '72 hours'),
      now() + interval '72 hours'
    );
  end if;
  return new;
end $$;

-- 7e. pause_care_sharing(link, NULL) retomava o compartilhamento calado.
create or replace function public.pause_care_sharing(p_link uuid, p_hours integer)
returns timestamptz
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_until timestamptz;
begin
  if p_hours is null or p_hours not in (0, 24, 168) then
    raise exception 'invalid_pause' using errcode = '22023';
  end if;
  v_until := case when p_hours = 0 then null else now() + make_interval(hours => p_hours) end;
  update public.caregiver_links
     set paused_until = v_until
   where id = p_link and cared_user_id = auth.uid() and status = 'accepted' and revoked_at is null;
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  return v_until;
end $$;
revoke all on function public.pause_care_sharing(uuid, integer) from public, anon;
grant execute on function public.pause_care_sharing(uuid, integer) to authenticated;

-- 7f. A pessoa já lê o próprio plano de cuidado e os próprios compromissos:
-- "participants manage plans" (care_scope_enabled devolve true para a própria
-- pessoa) e "participants manage appointments" (cared_user_id = auth.uid()),
-- ambas da fundação. Nada a mudar aqui.
