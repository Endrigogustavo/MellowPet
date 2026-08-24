-- Playlists de momento — criadas pelo usuário e amarradas a uma emoção.
--
-- A ideia: quando o Mellow detecta tristeza, ele não toca "uma playlist
-- qualquer de tristeza", toca a playlist que ESSA pessoa montou para quando
-- está triste. O acolhimento é mais eficaz com o repertório da própria pessoa.
--
-- As faixas vivem aqui (não só no Spotify) por dois motivos: a playlist
-- continua existindo se a pessoa desconectar o Spotify, e as faixas locais
-- em domínio público podem se misturar com as do Spotify na mesma lista.
--
-- Rode isto no SQL Editor do painel do Supabase.

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Emoção-alvo. Casa com EmotionKey em app/src/data/emotions.ts; 'unknown'
  -- fica de fora de propósito: não faz sentido montar playlist para um
  -- estado que o app não conseguiu ler.
  emotion text not null check (
    emotion in ('happy', 'sad', 'angry', 'neutral', 'surprised', 'disgusted', 'fearful')
  ),
  why text not null default '',
  color text not null default '#6C5CE7',
  -- Preenchidos só quando a playlist também foi espelhada na conta do
  -- Spotify da pessoa. Nulo = playlist só do MellowPet.
  spotify_uri text,
  spotify_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  title text not null,
  artist text not null default '',
  -- Uma das duas fontes precisa existir: URI do Spotify (toca via App
  -- Remote) ou URL direta de áudio (toca no player local).
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

-- Playlist é privada: só o dono lê e escreve. Um cuidador acompanha métricas
-- emocionais, não o repertório musical de quem ele cuida.
drop policy if exists "playlists own" on public.playlists;
create policy "playlists own" on public.playlists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- As faixas herdam a dona da playlist: sem o exists() abaixo, qualquer
-- usuário autenticado poderia inserir faixa na playlist de outra pessoa
-- passando um playlist_id adivinhado.
drop policy if exists "playlist tracks own" on public.playlist_tracks;
create policy "playlist tracks own" on public.playlist_tracks
  for all
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_tracks.playlist_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_tracks.playlist_id and p.user_id = auth.uid()
    )
  );
