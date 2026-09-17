export const CREATE_QUEUE_SCHEMA_SQL = `
  create table if not exists vision_queue (
    id text primary key not null,
    type text not null check (type in ('event', 'feedback')),
    event_id text not null,
    user_id text,
    created_at_ms integer not null,
    payload text not null
  );
  create index if not exists vision_queue_owner_type_age_idx
    on vision_queue (user_id, type, created_at_ms);
  create index if not exists vision_queue_age_idx on vision_queue (created_at_ms);
`;

export const SELECT_READY_ITEMS_SQL = `
  select q.id, q.created_at_ms, q.payload from vision_queue q
  where q.user_id = ? and q.type = ?
    and (? != 'feedback' or not exists (
      select 1 from vision_queue e where e.id = 'event_' || q.event_id
    ))
  order by q.created_at_ms, q.id limit ?
`;

export const SELECT_UNOWNED_FEEDBACK_SQL = `
  select id, created_at_ms, payload from vision_queue
  where type = 'feedback' and user_id is null
    and (created_at_ms > ? or (created_at_ms = ? and id > ?))
  order by created_at_ms, id limit ?
`;
