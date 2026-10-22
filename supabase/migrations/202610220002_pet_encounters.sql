-- Álbum de encontros: os pets que o seu pet conheceu pessoalmente.
--
-- Guarda só o "cartão" do outro pet (nome, espécie, estágio) e quando foi.
-- Não há referência à conta da outra pessoa — o encontro acontece por
-- proximidade, aparelho a aparelho, e nenhum dos dois lados sabe quem é o
-- dono do outro pet. Cada pessoa só vê o próprio álbum.

create table if not exists public.pet_encounters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  other_pet_name text not null check (char_length(other_pet_name) between 1 and 24),
  other_pet_type text not null,
  other_stage text not null check (other_stage in ('filhote', 'jovem', 'adulto')),
  met_at timestamptz not null default now()
);

create index if not exists pet_encounters_user_met_idx
  on public.pet_encounters (user_id, met_at desc);

alter table public.pet_encounters enable row level security;

drop policy if exists pet_encounters_select_own on public.pet_encounters;
create policy pet_encounters_select_own on public.pet_encounters
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists pet_encounters_insert_own on public.pet_encounters;
create policy pet_encounters_insert_own on public.pet_encounters
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists pet_encounters_delete_own on public.pet_encounters;
create policy pet_encounters_delete_own on public.pet_encounters
  for delete to authenticated using (user_id = (select auth.uid()));
