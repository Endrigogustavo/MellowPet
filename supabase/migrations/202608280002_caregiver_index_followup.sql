-- O projeto já possuía o índice equivalente emotion_events_user_id_idx.
-- Esta limpeza remove apenas a cópia criada pela primeira migration.
drop index if exists public.emotion_events_user_created_idx;
