-- Telemetria agregada do motor de visão local.
-- O app nunca envia pixels: somente intervalos, scores e feedback do usuário.

-- Compatível com as tabelas já existentes no projeto MellowPet: id identity,
-- event_id único e quality_reasons em jsonb. Não converte nem apaga dados.
-- emotion_events é legado; seu event_id precisa ser único para o upsert.

create table if not exists public.vision_intervals (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  session_id text not null,
  device_session_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('transition', 'heartbeat', 'session_end')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  observed_expression text not null,
  expression_distribution jsonb not null default '{}'::jsonb,
  signal_confidence real not null check (signal_confidence between 0 and 1),
  quality_mean real not null check (quality_mean between 0 and 1),
  accepted_coverage real not null check (accepted_coverage between 0 and 1),
  quality_reasons jsonb not null default '[]'::jsonb,
  tension_signal real check (tension_signal is null or tension_signal between 0 and 1),
  model_version text not null,
  pipeline_version text not null,
  quality_config_version text not null,
  calibration_version text,
  source text not null default 'mobile',
  created_at timestamptz not null default now()
);

create index if not exists vision_intervals_user_id_idx
  on public.vision_intervals (user_id, started_at desc);
create index if not exists vision_intervals_session_idx
  on public.vision_intervals (session_id, started_at desc);

alter table public.vision_intervals enable row level security;
revoke all on public.vision_intervals from public, anon, authenticated;
grant select, insert on public.vision_intervals to authenticated;

drop policy if exists vision_intervals_select_owner on public.vision_intervals;
drop policy if exists vision_intervals_owner_select on public.vision_intervals;
create policy vision_intervals_select_owner on public.vision_intervals
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists vision_intervals_insert_owner on public.vision_intervals;
drop policy if exists vision_intervals_owner_insert on public.vision_intervals;
create policy vision_intervals_insert_owner on public.vision_intervals
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create table if not exists public.vision_feedback (
  id bigint generated always as identity primary key,
  feedback_id text not null unique,
  event_id text not null references public.vision_intervals(event_id) on delete cascade,
  agreement text not null check (agreement in ('yes', 'no', 'unsure')),
  self_reported_state text,
  corrected_observed_expression text,
  note text,
  created_at_ts timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists vision_feedback_event_idx
  on public.vision_feedback (event_id);

alter table public.vision_feedback enable row level security;
revoke all on public.vision_feedback from public, anon, authenticated;
grant select, insert on public.vision_feedback to authenticated;

drop policy if exists vision_feedback_select_owner on public.vision_feedback;
drop policy if exists vision_feedback_owner_all on public.vision_feedback;
create policy vision_feedback_select_owner on public.vision_feedback
  for select to authenticated
  using (exists (
    select 1
    from public.vision_intervals vi
    where vi.event_id = vision_feedback.event_id
      and vi.user_id = (select auth.uid())
  ));

drop policy if exists vision_feedback_insert_owner on public.vision_feedback;
create policy vision_feedback_insert_owner on public.vision_feedback
  for insert to authenticated
  with check (exists (
    select 1
    from public.vision_intervals vi
    where vi.event_id = vision_feedback.event_id
      and vi.user_id = (select auth.uid())
  ));
