-- Endurecimento pós-revisão de segurança.
--
-- 1. Alertas: um cuidador só vê e mexe nos alertas do PRÓPRIO vínculo.
-- 2. Vínculo não pode ser apagado (o DELETE levava em cascata os check-ins,
--    compromissos e alertas da pessoa cuidada e não ficava auditado). Encerrar
--    é pela revogação, que preserva a trilha.
-- 3. Convites: valem 72 h, e aceitar convite tem limite de tentativas por
--    pessoa (força bruta de códigos).
-- 4. Grupos: o coordenador não pode ser membro do próprio grupo, só contam
--    membros com 7+ dias de grupo, o período é 7 ou 30 dias e as contagens
--    saem arredondadas — sem isso, contas falsas isolavam uma pessoa.
-- 5. Auditoria de viés: k = 10 e só contas com 30+ dias.
-- 6. Funções security definer com search_path vazio e nomes qualificados.

-- ── 1. alertas por vínculo ─────────────────────────────────────────────────
drop policy if exists "participants view alerts when enabled" on public.care_alerts;
drop policy if exists "participants update alerts when enabled" on public.care_alerts;
create policy "participants view alerts when enabled" on public.care_alerts for select to authenticated
using (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id))
      and (select private.care_scope_enabled(cared_user_id, 'alerts')))
);
create policy "participants update alerts when enabled" on public.care_alerts for update to authenticated
using (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id))
      and (select private.care_scope_enabled(cared_user_id, 'alerts')))
)
with check (
  cared_user_id = (select auth.uid())
  or (caregiver_link_id = (select private.care_link_for(cared_user_id))
      and (select private.care_scope_enabled(cared_user_id, 'alerts')))
);

-- ── 2. sem DELETE de vínculo ───────────────────────────────────────────────
drop policy if exists caregiver_links_delete_party on public.caregiver_links;
revoke delete on public.caregiver_links from authenticated;

-- ── 3. convites: validade e limite de tentativas ───────────────────────────
create or replace function private.default_invite_expiry()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'pending' and new.expires_at is null then
    new.expires_at := now() + interval '72 hours';
  end if;
  return new;
end $$;

drop trigger if exists caregiver_links_invite_expiry on public.caregiver_links;
create trigger caregiver_links_invite_expiry
  before insert on public.caregiver_links
  for each row execute function private.default_invite_expiry();

create table if not exists private.invite_attempts (
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists invite_attempts_user_idx on private.invite_attempts (user_id, attempted_at desc);

create or replace function public.accept_invite(code text)
returns public.caregiver_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.caregiver_links;
  recent integer;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  -- 10 tentativas por hora por pessoa: o suficiente para quem erra digitando,
  -- inútil para quem tenta adivinhar códigos.
  delete from private.invite_attempts where attempted_at < now() - interval '1 day';
  select count(*) into recent from private.invite_attempts
    where user_id = auth.uid() and attempted_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'too_many_attempts' using errcode = '54000';
  end if;
  insert into private.invite_attempts (user_id) values (auth.uid());

  select * into link from public.caregiver_links where invite_code = code for update;
  if link is null then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  if link.status = 'accepted' then raise exception 'invite_already_accepted' using errcode = '23505'; end if;
  if link.revoked_at is not null then raise exception 'invite_revoked' using errcode = '22023'; end if;
  if link.expires_at is not null and link.expires_at <= now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  if link.caregiver_user_id = auth.uid() then raise exception 'cannot_accept_own_invite' using errcode = '22023'; end if;
  -- A validade de 72 h é do CONVITE; o vínculo aceito vale até ser revogado.
  update public.caregiver_links
  set cared_user_id = auth.uid(), status = 'accepted', accepted_at = now(), expires_at = null
  where id = link.id
  returning * into link;
  return link;
end;
$$;

-- ── 4. grupos ──────────────────────────────────────────────────────────────
create or replace function public.create_care_group(group_name text)
returns table (id uuid, code text)
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(trim(group_name)) not between 2 and 60 then raise exception 'invalid group name'; end if;
  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)), 1);
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
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
  owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select g.id, g.owner_id into gid, owner from public.care_groups g where g.code = upper(trim(group_code));
  if gid is null then raise exception 'group not found'; end if;
  -- O coordenador não entra no próprio grupo (nem as contas dele).
  if owner = auth.uid() then raise exception 'owner cannot join'; end if;
  insert into public.care_group_members (group_id, user_id) values (gid, auth.uid())
    on conflict do nothing;
  return gid;
end $$;

drop function if exists public.care_group_summary(uuid, integer);
create function public.care_group_summary(gid uuid, days integer default 7)
returns table (members_band text, emotion text, share numeric)
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select 1 from public.care_groups g where g.id = gid and g.owner_id = auth.uid()
  ),
  -- Só membros com 7+ dias de grupo: contas criadas para "cercar" alguém
  -- não entram na conta na hora.
  settled as (
    select m.user_id from public.care_group_members m
    where m.group_id = gid and m.joined_at < now() - interval '7 days'
  ),
  ev as (
    select e.user_id, e.emotion
    from public.emotion_events e
    join settled s on s.user_id = e.user_id
    where exists (select 1 from allowed)
      and e.emotion <> 'unknown'
      -- Só 7 ou 30 dias: janelas arbitrárias permitiam subtrair resultados.
      and e.created_at > now() - (case when days >= 30 then interval '30 days' else interval '7 days' end)
  ),
  totals as (select count(distinct user_id) as people, count(*) as n from ev)
  select
    case when t.people >= 20 then '20+' when t.people >= 10 then '10-19' else '5-9' end,
    ev.emotion,
    -- Arredondado a 5%: pequenas diferenças não denunciam uma pessoa.
    round(round(count(*)::numeric / nullif(t.n, 0) * 20) / 20, 2)
  from ev cross join totals t
  where t.people >= 5
  group by t.people, t.n, ev.emotion
  order by 3 desc;
$$;

revoke all on function public.create_care_group(text) from public, anon;
revoke all on function public.join_care_group(text) from public, anon;
revoke all on function public.care_group_summary(uuid, integer) from public, anon;
grant execute on function public.create_care_group(text) to authenticated;
grant execute on function public.join_care_group(text) to authenticated;
grant execute on function public.care_group_summary(uuid, integer) to authenticated;

-- ── 5. auditoria de viés ───────────────────────────────────────────────────
drop function if exists public.vision_fairness_report(integer);
create function public.vision_fairness_report(min_users integer default 10)
returns table (attribute text, grp text, users bigint, samples bigint, agree bigint)
language sql stable security definer set search_path = '' as $$
  with eligible as (
    -- Contas com 30+ dias: contas novas criadas para completar um grupo raro
    -- e isolar alguém não entram.
    select u.id from auth.users u where u.created_at < now() - interval '30 days'
  ),
  labeled as (
    select c.user_id, (c.emotion = c.detected_emotion) as ok
    from public.checkins c
    join eligible el on el.id = c.user_id
    where c.detected_emotion is not null
      and c.created_at > now() - interval '180 days'
  ),
  groups as (
    select p.user_id, 'oculos'::text as attribute, p.glasses as grp
      from public.vision_audit_profile p where p.glasses is not null
    union all
    select p.user_id, 'idade', p.age_band
      from public.vision_audit_profile p where p.age_band is not null
    union all
    select p.user_id, 'barba', p.facial_hair
      from public.vision_audit_profile p where p.facial_hair is not null
  )
  select g.attribute, g.grp,
         count(distinct l.user_id) as users,
         count(*) as samples,
         count(*) filter (where l.ok) as agree
  from groups g
  join labeled l on l.user_id = g.user_id
  group by g.attribute, g.grp
  having count(distinct l.user_id) >= greatest(coalesce(min_users, 10), 10)
  order by g.attribute, g.grp;
$$;

revoke all on function public.vision_fairness_report(integer) from public, anon;
grant execute on function public.vision_fairness_report(integer) to authenticated;
