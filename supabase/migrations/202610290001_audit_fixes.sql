-- Correções de auditoria:
-- 1. accept_invite persiste tentativas malsucedidas sem rollback (retorna erro
--    estruturado em JSONB para não abortar a transação do INSERT em
--    private.invite_attempts).
-- 2. care_alerts UPDATE restrito apenas ao cuidador vinculado (remove
--    cared_user_id = auth.uid() da política de UPDATE).
-- 3. Migração das tabelas public.playlists e public.playlist_tracks.

-- ── 1. accept_invite: rate limit persistente sem rollback ──────────────────
drop function if exists public.accept_invite(text);
create function public.accept_invite(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.caregiver_links;
  recent integer;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  delete from private.invite_attempts where attempted_at < now() - interval '1 day';
  select count(*) into recent from private.invite_attempts
    where user_id = auth.uid() and attempted_at > now() - interval '1 hour';
  if recent >= 10 then
    return jsonb_build_object('error', 'too_many_attempts', 'code', '54000');
  end if;
  insert into private.invite_attempts (user_id) values (auth.uid());

  select * into link from public.caregiver_links where invite_code = code for update;
  if link is null then
    return jsonb_build_object('error', 'invite_not_found', 'code', 'P0002');
  end if;
  if link.status = 'accepted' then
    return jsonb_build_object('error', 'invite_already_accepted', 'code', '23505');
  end if;
  if link.revoked_at is not null then
    return jsonb_build_object('error', 'invite_revoked', 'code', '22023');
  end if;
  if link.expires_at is not null and link.expires_at <= now() then
    return jsonb_build_object('error', 'invite_expired', 'code', '22023');
  end if;
  if link.caregiver_user_id = auth.uid() then
    return jsonb_build_object('error', 'cannot_accept_own_invite', 'code', '22023');
  end if;

  update public.caregiver_links
  set cared_user_id = auth.uid(), status = 'accepted', accepted_at = now(), expires_at = null
  where id = link.id
  returning * into link;
  return to_jsonb(link);
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ── 2. care_alerts: somente o cuidador do vínculo pode atualizar ───────────
drop policy if exists "participants update alerts when enabled" on public.care_alerts;
drop policy if exists care_alerts_update_linked on public.care_alerts;
create policy "participants update alerts when enabled" on public.care_alerts for update to authenticated
using (
  caregiver_link_id = (select private.care_link_for(cared_user_id))
  and (select private.care_scope_enabled(cared_user_id, 'alerts'))
)
with check (
  caregiver_link_id = (select private.care_link_for(cared_user_id))
  and (select private.care_scope_enabled(cared_user_id, 'alerts'))
);

-- ── 3. playlists e faixas ──────────────────────────────────────────────────
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emotion text not null check (
    emotion in ('happy', 'sad', 'angry', 'neutral', 'surprised', 'disgusted', 'fearful')
  ),
  why text not null default '',
  color text not null default '#6C5CE7',
  spotify_uri text,
  spotify_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  title text not null,
  artist text not null default '',
  spotify_uri text,
  url text,
  duration integer not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint playlist_tracks_has_source check (spotify_uri is not null or url is not null)
);

create index if not exists playlists_user_emotion_idx on public.playlists (user_id, emotion);
create index if not exists playlist_tracks_playlist_idx on public.playlist_tracks (playlist_id, position);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

revoke all on public.playlists from public, anon;
revoke all on public.playlist_tracks from public, anon;
grant select, insert, update, delete on public.playlists to authenticated;
grant select, insert, update, delete on public.playlist_tracks to authenticated;

drop policy if exists "playlists own" on public.playlists;
create policy "playlists own" on public.playlists
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "playlist tracks own" on public.playlist_tracks;
create policy "playlist tracks own" on public.playlist_tracks
  for all to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_tracks.playlist_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_tracks.playlist_id and p.user_id = (select auth.uid())
    )
  );
