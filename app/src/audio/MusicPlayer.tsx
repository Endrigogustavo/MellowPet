import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { PLAYLISTS, type Playlist, type Track } from '../data/content';

type MusicValue = {
  /** Playlist carregada — continua definida quando pausada. */
  playlist: Playlist | null;
  track: Track | null;
  /** Posição da faixa dentro da playlist. */
  index: number;
  isPlaying: boolean;
  isBuffering: boolean;
  /** Segundos. */
  position: number;
  duration: number;
  /** 0..1, já protegido contra divisão por zero. */
  progress: number;
  /** Toca a playlist do começo. */
  start: (id: string) => void;
  /** Mesma playlist: pausa/retoma. Outra playlist: troca e toca. */
  toggle: (id: string) => void;
  /** Pausa e retoma a faixa atual. */
  togglePlayback: () => void;
  /** Pula para a próxima faixa. */
  skip: () => void;
  /** Toca uma fila montada na hora (jornada ISO). */
  startQueue: (name: string, tracks: Track[]) => void;
};

const MusicContext = createContext<MusicValue | null>(null);

/** Id da fila montada na hora; não colide com as playlists fixas. */
const QUEUE_ID = 'fila';

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  /** Intenção do usuário: sem isto, a faixa seguinte carregaria em pausa. */
  const [wantPlaying, setWantPlaying] = useState(false);
  const [queue, setQueue] = useState<Playlist | null>(null);

  const playlist = useMemo(
    () => (playlistId === QUEUE_ID ? queue : (PLAYLISTS.find((p) => p.id === playlistId) ?? null)),
    [playlistId, queue]
  );
  const track = playlist ? (playlist.tracks[index] ?? null) : null;

  // Trocar a URL recria o player (useAudioPlayer é keyed pela fonte).
  const player = useAudioPlayer(track ? track.url : null);
  const status = useAudioPlayerStatus(player);

  // Tocar mesmo com o telefone no silencioso — é áudio que o usuário pediu.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {
      // Sem modo de áudio o player ainda funciona; não vale derrubar a tela.
    });
  }, []);

  // Autoplay assim que a faixa nova termina de carregar.
  useEffect(() => {
    if (wantPlaying && status.isLoaded && !status.playing) {
      player.play();
    }
  }, [wantPlaying, status.isLoaded, status.playing, player]);

  // Fim da faixa: segue para a próxima, voltando ao início no fim da lista.
  useEffect(() => {
    if (!status.didJustFinish || !playlist) return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % playlist.tracks.length);
    }, 0);
    return () => clearTimeout(timer);
  }, [status.didJustFinish, playlist]);

  const start = useCallback((id: string) => {
    setPlaylistId(id);
    setIndex(0);
    setWantPlaying(true);
  }, []);

  const startQueue = useCallback((name: string, tracks: Track[]) => {
    if (tracks.length === 0) return;
    setQueue({ id: QUEUE_ID, name, why: 'Jornada ISO', c: '#7B6CF6', spotifyUri: '', tracks });
    setPlaylistId(QUEUE_ID);
    setIndex(0);
    setWantPlaying(true);
  }, []);

  const togglePlayback = useCallback(() => {
    if (status.playing) {
      player.pause();
      setWantPlaying(false);
    } else {
      setWantPlaying(true);
      player.play();
    }
  }, [player, status.playing]);

  const toggle = useCallback(
    (id: string) => {
      if (id !== playlistId) start(id);
      else togglePlayback();
    },
    [playlistId, start, togglePlayback]
  );

  const skip = useCallback(() => {
    if (!playlist) return;
    setIndex((i) => (i + 1) % playlist.tracks.length);
    setWantPlaying(true);
  }, [playlist]);

  const duration = status.duration > 0 ? status.duration : (track?.duration ?? 0);

  const value = useMemo<MusicValue>(
    () => ({
      playlist,
      track,
      index,
      isPlaying: status.playing,
      isBuffering: status.isBuffering || (wantPlaying && !status.isLoaded),
      position: status.currentTime,
      duration,
      progress: duration > 0 ? Math.min(1, status.currentTime / duration) : 0,
      start,
      toggle,
      togglePlayback,
      skip,
      startQueue,
    }),
    [
      playlist,
      track,
      index,
      status.playing,
      status.isBuffering,
      status.isLoaded,
      status.currentTime,
      wantPlaying,
      duration,
      start,
      toggle,
      togglePlayback,
      skip,
      startQueue,
    ]
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic(): MusicValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic precisa estar dentro de <MusicProvider>');
  return ctx;
}
