-- Check-in emocional manual: o que a pessoa diz que sente, com contexto
-- (tags), sono e um retrato do que a câmera estava lendo naquele instante.
--
-- Fica em tabela própria, e não em emotion_events, porque carrega texto livre
-- e tags — dado mais sensível que uma leitura. O cliente também grava uma
-- linha em emotion_events (source = 'checkin') para o dashboard, a sequência
-- e a RPC do cuidador continuarem funcionando sem mudança.
--
-- Cuidador NÃO lê esta tabela: a ADR de acesso integral vale só para os
-- agregados da RPC (docs/caregiver-module.md). Texto e tags são do dono.

create extension if not exists pgcrypto;

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emotion text not null
    check (emotion in ('happy', 'sad', 'angry', 'neutral', 'surprised', 'disgusted', 'fearful')),
  note text not null default '' check (char_length(note) <= 280),
  tags text[] not null default '{}',
  -- 1 = muito mal, 5 = muito bem. Nulo quando a pessoa não respondeu.
  sleep_quality smallint check (sleep_quality between 1 and 5),
  -- Retrato da leitura no momento do check-in. Nulo = sem leitura confiável.
  detected_emotion text
    check (detected_emotion is null or detected_emotion in ('happy', 'sad', 'angry', 'neutral', 'surprised', 'disgusted', 'fearful')),
  detected_confidence real check (detected_confidence is null or detected_confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists checkins_user_created_idx
  on public.checkins (user_id, created_at desc);

alter table public.checkins enable row level security;

drop policy if exists checkins_select_own on public.checkins;
create policy checkins_select_own on public.checkins
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists checkins_insert_own on public.checkins;
create policy checkins_insert_own on public.checkins
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists checkins_delete_own on public.checkins;
create policy checkins_delete_own on public.checkins
  for delete to authenticated
  using (user_id = auth.uid());

-- Sem update: um check-in é um registro do momento. Errou, apaga e refaz.
