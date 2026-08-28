-- Índices de chaves estrangeiras que não estão cobertas por PK/UNIQUE nem
-- pelos índices de leitura do módulo. Eles evitam scans em exclusões de
-- usuários/vínculos e atendem aos avisos de performance do advisor.
create index if not exists care_alerts_link_idx on public.care_alerts (caregiver_link_id);
create index if not exists care_alerts_acknowledged_by_idx on public.care_alerts (acknowledged_by);
create index if not exists care_alerts_resolved_by_idx on public.care_alerts (resolved_by);
create index if not exists care_checkins_link_idx on public.care_checkins (caregiver_link_id);
create index if not exists care_checkins_created_by_idx on public.care_checkins (created_by);
create index if not exists care_appointments_link_idx on public.care_appointments (caregiver_link_id);
create index if not exists care_appointments_created_by_idx on public.care_appointments (created_by);
create index if not exists care_plans_updated_by_idx on public.care_plans (updated_by);
create index if not exists care_team_members_cared_idx on public.care_team_members (cared_user_id);
create index if not exists care_team_members_created_by_idx on public.care_team_members (created_by);
create index if not exists caregiver_consents_cared_idx on public.caregiver_consents (cared_user_id);
create index if not exists caregiver_notes_caregiver_idx on public.caregiver_notes (caregiver_user_id);
create index if not exists caregiver_notes_cared_idx on public.caregiver_notes (cared_user_id);
create index if not exists care_support_actions_cared_idx on public.care_support_actions (cared_user_id);
create index if not exists care_support_actions_link_idx on public.care_support_actions (caregiver_link_id);
create index if not exists care_support_actions_created_by_idx on public.care_support_actions (created_by);
create index if not exists care_audit_log_link_idx on public.care_audit_log (caregiver_link_id);
create index if not exists care_audit_log_actor_idx on public.care_audit_log (actor_user_id);
