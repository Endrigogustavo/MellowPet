-- Revoga sem apagar o vínculo: corta o acesso imediatamente e preserva a
-- trilha operacional. A função valida que o solicitante é uma das partes.
create or replace function public.revoke_care_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_link public.caregiver_links;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  select * into v_link
  from public.caregiver_links
  where id = p_link_id
  for update;

  if v_link is null then
    raise exception 'care_link_not_found' using errcode = 'P0002';
  end if;
  if v_link.caregiver_user_id <> auth.uid()
     and v_link.cared_user_id is distinct from auth.uid() then
    raise exception 'care_link_forbidden' using errcode = '42501';
  end if;

  if v_link.revoked_at is not null then
    return;
  end if;

  update public.caregiver_links
  set revoked_at = now()
  where id = p_link_id;

  update public.caregiver_consents
  set status = 'revoked', revoked_at = coalesce(revoked_at, now())
  where caregiver_link_id = p_link_id and status = 'active';
end;
$$;

revoke all on function public.revoke_care_link(uuid) from public, anon;
grant execute on function public.revoke_care_link(uuid) to authenticated;
