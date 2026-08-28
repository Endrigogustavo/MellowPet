-- A ACL de realtime.send é controlada pela extensão e não pode ser endurecida
-- por esta migration. Sem essa garantia, não mantenha canal de cuidado ativo.
drop trigger if exists care_audit_log_minimal_realtime on public.care_audit_log;
drop policy if exists "care participants receive minimal invalidations" on realtime.messages;
drop function if exists private.broadcast_care_invalidation();
revoke all on function private.care_realtime_topic_cared_user_id(text) from public, anon, authenticated;
drop function if exists private.care_realtime_topic_cared_user_id(text);
