-- Modo escola/clínica: um coordenador vê o humor AGREGADO de um grupo
-- (turma, equipe, grupo terapêutico), nunca o de uma pessoa.
--
-- Garantias:
-- - entrar é escolha de cada pessoa, por código; sair apaga o vínculo;
-- - o coordenador não lê emotion_events de ninguém: só a RPC agregada;
-- - a RPC só responde com pelo menos 5 pessoas com leituras no período
--   (k-anonimato), e mesmo assim só a distribuição, sem contagem por pessoa;
-- - nem a lista de membros é exposta, só o total.

create extension if not exists pgcrypto;

create table if not exists public.care_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.care_group_members (
  group_id uuid not null references public.care_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.care_groups enable row level security;
alter table public.care_group_members enable row level security;
revoke all on public.care_groups, public.care_group_members from public, anon;
grant select on public.care_groups, public.care_group_members to authenticated;
grant delete on public.care_group_members to authenticated;

-- Vê os grupos que criou ou dos quais participa.
drop policy if exists care_groups_visible on public.care_groups;
create policy care_groups_visible on public.care_groups
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.care_group_members m
               where m.group_id = care_groups.id and m.user_id = (select auth.uid()))
  );

-- Cada pessoa vê e apaga só o próprio vínculo.
drop policy if exists care_group_members_own on public.care_group_members;
create policy care_group_members_own on public.care_group_members
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists care_group_members_leave on public.care_group_members;
create policy care_group_members_leave on public.care_group_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Cria um grupo e devolve o código (8 caracteres, sem 0/O/1/I).
create or replace function public.create_care_group(group_name text)
returns table (id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.care_groups g where g.code = new_code);
  end loop;
  return query
    insert into public.care_groups (name, code, owner_id)
    values (trim(group_name), new_code, auth.uid())
    returning care_groups.id, care_groups.code;
end $$;

create or replace function public.join_care_group(group_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select g.id into gid from public.care_groups g where g.code = upper(trim(group_code));
  if gid is null then raise exception 'group not found'; end if;
  insert into public.care_group_members (group_id, user_id) values (gid, auth.uid())
    on conflict do nothing;
  return gid;
end $$;

-- Distribuição de emoções dos últimos `days` dias. Só o dono do grupo chama;
-- abaixo de 5 pessoas com dados, devolve vazio (e o app explica o porquê).
create or replace function public.care_group_summary(gid uuid, days integer default 7)
returns table (members bigint, people_with_data bigint, emotion text, share numeric)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select 1 from public.care_groups g where g.id = gid and g.owner_id = auth.uid()
  ),
  ev as (
    select e.user_id, e.emotion
    from public.emotion_events e
    join public.care_group_members m on m.user_id = e.user_id and m.group_id = gid
    where exists (select 1 from allowed)
      and e.emotion <> 'unknown'
      and e.created_at > now() - make_interval(days => greatest(1, least(coalesce(days, 7), 30)))
  ),
  totals as (
    select (select count(*) from public.care_group_members m where m.group_id = gid) as members,
           count(distinct user_id) as people,
           count(*) as n
    from ev
  )
  select t.members, t.people, ev.emotion, round(count(*)::numeric / nullif(t.n, 0), 3)
  from ev cross join totals t
  where t.people >= 5
  group by t.members, t.people, t.n, ev.emotion
  order by 4 desc;
$$;

revoke all on function public.create_care_group(text) from public, anon;
revoke all on function public.join_care_group(text) from public, anon;
revoke all on function public.care_group_summary(uuid, integer) from public, anon;
grant execute on function public.create_care_group(text) to authenticated;
grant execute on function public.join_care_group(text) to authenticated;
grant execute on function public.care_group_summary(uuid, integer) to authenticated;
