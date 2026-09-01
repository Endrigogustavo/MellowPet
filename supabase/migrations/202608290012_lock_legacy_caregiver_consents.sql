-- A tabela existe apenas para preservar a trilha histórica do modelo antigo.
-- A policy explícita mantém RLS documentado e nega todas as operações do app.
create policy "legacy consents unavailable to clients"
on public.caregiver_consents
as restrictive
for all
to authenticated
using (false)
with check (false);
