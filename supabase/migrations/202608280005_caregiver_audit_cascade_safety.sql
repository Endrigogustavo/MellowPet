-- Uma exclusão em cascata pode chegar ao gatilho depois que o vínculo ou a
-- pessoa acompanhada já não existe. A auditoria não deve impedir essa limpeza.
create or replace function private.log_care_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_cared_user_id uuid := (v_row ->> 'cared_user_id')::uuid;
  v_link_id uuid := nullif(v_row ->> 'caregiver_link_id', '')::uuid;
  v_record_id uuid := nullif(v_row ->> 'id', '')::uuid;
begin
  if v_cared_user_id is null
     or not exists (select 1 from auth.users where id = v_cared_user_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_link_id is not null
     and not exists (select 1 from public.caregiver_links where id = v_link_id) then
    v_link_id := null;
  end if;

  insert into public.care_audit_log (
    cared_user_id, caregiver_link_id, actor_user_id, action, metadata
  ) values (
    v_cared_user_id,
    v_link_id,
    coalesce(auth.uid(), v_cared_user_id),
    tg_table_schema || '.' || tg_table_name || '.' || lower(tg_op),
    jsonb_build_object('record_id', v_record_id)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.log_care_audit() from public, anon, authenticated;
