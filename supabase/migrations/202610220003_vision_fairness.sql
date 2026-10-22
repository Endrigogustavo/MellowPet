-- Auditoria de viés da leitura facial.
--
-- Um motor de expressão pode acertar menos em quem usa óculos, tem barba ou
-- um tom de pele pouco representado nos dados de treino. Para enxergar isso
-- é preciso (a) saber a qual grupo a pessoa pertence — só se ela quiser
-- dizer — e (b) um rótulo de verdade: o check-in, onde a pessoa diz o que
-- sente e o app guarda o que a câmera lia no mesmo instante.
--
-- Os atributos são opcionais, autodeclarados e apagáveis. O relatório só
-- devolve agregados de grupos com pelo menos 5 pessoas distintas
-- (k-anonimato): ninguém descobre a taxa de acerto de um indivíduo.

create table if not exists public.vision_audit_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  glasses text check (glasses is null or glasses in ('sim', 'nao', 'as_vezes')),
  -- Escala Monk (1 = mais clara, 10 = mais escura). Agregada em faixas no relatório.
  skin_tone smallint check (skin_tone is null or skin_tone between 1 and 10),
  age_band text check (age_band is null or age_band in ('<18', '18-24', '25-34', '35-49', '50+')),
  facial_hair text check (facial_hair is null or facial_hair in ('sim', 'nao')),
  updated_at timestamptz not null default now()
);

alter table public.vision_audit_profile enable row level security;
revoke all on public.vision_audit_profile from public, anon;
grant select, insert, update, delete on public.vision_audit_profile to authenticated;

drop policy if exists vision_audit_profile_owner on public.vision_audit_profile;
create policy vision_audit_profile_owner on public.vision_audit_profile
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Acerto por grupo nos últimos 180 dias. security definer porque precisa ler
-- check-ins de todo mundo; devolve só contagens, e só de grupos com k >= 5.
create or replace function public.vision_fairness_report(min_users integer default 5)
returns table (attribute text, grp text, users bigint, samples bigint, agree bigint)
language sql
stable
security definer
set search_path = public
as $$
  with labeled as (
    select c.user_id, (c.emotion = c.detected_emotion) as ok
    from public.checkins c
    where c.detected_emotion is not null
      and c.created_at > now() - interval '180 days'
  ),
  groups as (
    select user_id, 'oculos'::text as attribute, glasses as grp
      from public.vision_audit_profile where glasses is not null
    union all
    select user_id, 'tom_de_pele',
      case when skin_tone <= 3 then '1-3' when skin_tone <= 6 then '4-6' else '7-10' end
      from public.vision_audit_profile where skin_tone is not null
    union all
    select user_id, 'idade', age_band
      from public.vision_audit_profile where age_band is not null
    union all
    select user_id, 'barba', facial_hair
      from public.vision_audit_profile where facial_hair is not null
  )
  select g.attribute, g.grp,
         count(distinct l.user_id) as users,
         count(*) as samples,
         count(*) filter (where l.ok) as agree
  from groups g
  join labeled l on l.user_id = g.user_id
  group by g.attribute, g.grp
  -- O piso de 5 vale mesmo que o chamador peça menos.
  having count(distinct l.user_id) >= greatest(coalesce(min_users, 5), 5)
  order by g.attribute, g.grp;
$$;

revoke all on function public.vision_fairness_report(integer) from public, anon;
grant execute on function public.vision_fairness_report(integer) to authenticated;
