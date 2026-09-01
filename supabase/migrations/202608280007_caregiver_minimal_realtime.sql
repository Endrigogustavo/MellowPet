-- Invalidação em tempo real sem transmitir linhas do módulo de cuidado.
-- O único payload é {}, e o cliente busca dados novamente sob RLS normal.
create or replace function private.care_realtime_topic_cared_user_id(p_topic text)
returns uuid
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case
    when p_topic ~ '^care:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:invalidate$'
      then split_part(p_topic, ':', 2)::uuid
    else null
  end;
$$;

revoke all on function private.care_realtime_topic_cared_user_id(text) from public, anon, authenticated;
grant execute on function private.care_realtime_topic_cared_user_id(text) to authenticated;

drop policy if exists "care participants receive minimal invalidations" on realtime.messages;
create policy "care participants receive minimal invalidations"
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and private is true
  and (select private.care_realtime_topic_cared_user_id(realtime.topic())) is not null
  and (
    (select auth.uid()) = (select private.care_realtime_topic_cared_user_id(realtime.topic()))
    or (select private.care_link_for((select private.care_realtime_topic_cared_user_id(realtime.topic())))) is not null
  )
);

-- O app não envia broadcasts; apenas o gatilho interno abaixo pode gerar a
-- invalidação. Isso impede que um cliente injete notificações no canal.
revoke execute on function realtime.send(jsonb, text, text, boolean) from anon, authenticated;

create or replace function private.broadcast_care_invalidation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_cared_user_id uuid := case when tg_op = 'DELETE' then old.cared_user_id else new.cared_user_id end;
begin
  if v_cared_user_id is not null then
    perform realtime.send(
      '{}'::jsonb,
      'invalidate',
      format('care:%s:invalidate', v_cared_user_id),
      true
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists care_audit_log_minimal_realtime on public.care_audit_log;
create trigger care_audit_log_minimal_realtime
after insert on public.care_audit_log
for each row execute function private.broadcast_care_invalidation();

revoke all on function private.broadcast_care_invalidation() from public, anon, authenticated;
