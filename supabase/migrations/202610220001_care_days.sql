-- Dias de autocuidado: um registro por pessoa por dia em que houve algum
-- cuidado (check-in, alimentar, brincar, respirar, encontro com outro pet).
--
-- É a base do crescimento do pet (filhote → jovem → adulto). Conta DIAS
-- distintos de propósito: passar horas no app no mesmo dia não acelera nada,
-- e um dia ruim não faz o pet regredir — o crescimento mede consistência,
-- não tempo de tela.
--
-- `day` é a data LOCAL da pessoa, enviada pelo app. Gravar pelo relógio do
-- servidor (UTC) partiria a noite de quem está no Brasil em dois dias.

create table if not exists public.care_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.care_days enable row level security;

drop policy if exists care_days_select_own on public.care_days;
create policy care_days_select_own on public.care_days
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists care_days_insert_own on public.care_days;
create policy care_days_insert_own on public.care_days
  for insert to authenticated
  -- Aceita só hoje ou ontem (fuso), para não dar para "fabricar" dias
  -- passados e pular estágios.
  with check (
    user_id = (select auth.uid())
    and day between (current_date - 1) and (current_date + 1)
  );

-- Sem update nem delete: um dia de cuidado aconteceu ou não.
