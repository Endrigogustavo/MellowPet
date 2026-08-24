import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';

import MellowSpotify, {
  isMellowSpotifyAvailable,
  type SpotifyPlayerStateEvent,
} from '../../modules/mellow-spotify';
import {
  beginSpotifyAuth,
  clearTokens,
  completeSpotifyAuth,
  loadTokens,
  SPOTIFY_CLIENT_CONFIGURED,
  SPOTIFY_REDIRECT_URI,
} from './spotifyAuth';
import { forgetCachedUser } from './spotifyApi';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

export const SPOTIFY_CONFIGURED = isMellowSpotifyAvailable && SPOTIFY_CLIENT_CONFIGURED;

type NowPlaying = {
  trackName: string | null;
  artistName: string | null;
  trackUri: string | null;
  isPaused: boolean;
};

type SpotifyValue = {
  /** Módulo nativo presente neste build (falso no iOS por enquanto). */
  available: boolean;
  /** A pessoa autorizou o app na conta dela — habilita criar playlist. */
  authorized: boolean;
  /** App Remote falando com o app do Spotify — habilita tocar. */
  connected: boolean;
  connecting: boolean;
  error: string | null;
  nowPlaying: NowPlaying | null;
  currentUri: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  playUri: (uri: string) => Promise<void>;
  /** Toca a primeira faixa e enfileira o resto — usado por playlist do
   * MellowPet que não tem equivalente na conta do Spotify. */
  playTracks: (uris: string[], contextKey: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  clearError: () => void;
};

const SpotifyContext = createContext<SpotifyValue | null>(null);

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [currentUri, setCurrentUri] = useState<string | null>(null);

  /** App Remote só conecta depois que a pessoa autorizou o app na conta
   * dela; sem isso o SDK responde "Explicit user authorization is required".
   * Por isso o fluxo é sempre OAuth primeiro, App Remote depois. */
  const connectAppRemote = useCallback(async () => {
    if (!MellowSpotify) return;
    try {
      await MellowSpotify.connect(CLIENT_ID, SPOTIFY_REDIRECT_URI);
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      const message = err instanceof Error ? err.message : 'Não foi possível conectar ao Spotify.';
      setError(
        message.includes('CouldNotFindSpotifyApp') || message.includes('not installed')
          ? 'Instale o app do Spotify para tocar as playlists.'
          : message
      );
    }
  }, []);

  // Sessão anterior: se já existe token guardado, a pessoa não precisa
  // autorizar de novo a cada abertura do app.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    loadTokens().then((tokens) => {
      if (tokens) setAuthorized(true);
    });
  }, []);

  useEffect(() => {
    if (!isMellowSpotifyAvailable || !MellowSpotify) return;
    const playerSub = MellowSpotify.addListener(
      'onPlayerStateChanged',
      (event: SpotifyPlayerStateEvent) => {
        setNowPlaying({
          trackName: event.trackName,
          artistName: event.artistName,
          trackUri: event.trackUri,
          isPaused: event.isPaused,
        });
      }
    );
    const connectionSub = MellowSpotify.addListener('onConnectionChanged', (event) => {
      setConnected(event.connected);
      if (!event.connected) setNowPlaying(null);
      if (event.error) setError(event.error);
    });
    return () => {
      playerSub.remove();
      connectionSub.remove();
    };
  }, []);

  /** Retorno do consentimento no navegador. */
  useEffect(() => {
    const handleUrl = (url: string) => {
      completeSpotifyAuth(url)
        .then((tokens) => {
          if (!tokens) return;
          setAuthorized(true);
          setError(null);
          return connectAppRemote();
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Falha ao autorizar o Spotify.');
        })
        .finally(() => setConnecting(false));
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [connectAppRemote]);

  const connect = useCallback(async () => {
    if (!SPOTIFY_CONFIGURED || !MellowSpotify) {
      setError(
        isMellowSpotifyAvailable
          ? 'EXPO_PUBLIC_SPOTIFY_CLIENT_ID não definido neste build.'
          : 'Este build não contém o módulo nativo do Spotify.'
      );
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const tokens = await loadTokens();
      if (tokens) {
        setAuthorized(true);
        await connectAppRemote();
        setConnecting(false);
        return;
      }
      // Abre o navegador. `connecting` continua ligado até o deep link
      // voltar (ou o usuário desistir e tocar em conectar de novo).
      await beginSpotifyAuth();
    } catch (err) {
      setConnecting(false);
      setError(err instanceof Error ? err.message : 'Não foi possível conectar ao Spotify.');
    }
  }, [connectAppRemote]);

  const disconnect = useCallback(async () => {
    if (MellowSpotify) await MellowSpotify.disconnect().catch(() => undefined);
    await clearTokens();
    forgetCachedUser();
    setConnected(false);
    setAuthorized(false);
    setNowPlaying(null);
    setCurrentUri(null);
  }, []);

  const playUri = useCallback(
    async (uri: string) => {
      if (!MellowSpotify) return;
      if (!connected) await connectAppRemote();
      await MellowSpotify.play(uri);
      setCurrentUri(uri);
    },
    [connected, connectAppRemote]
  );

  const playTracks = useCallback(
    async (uris: string[], contextKey: string) => {
      if (!MellowSpotify || uris.length === 0) return;
      if (!connected) await connectAppRemote();
      await MellowSpotify.play(uris[0]);
      // Enfileirar em sequência (e não em paralelo) porque a ordem da fila é
      // a ordem em que o Spotify recebe as chamadas.
      for (const uri of uris.slice(1)) {
        await MellowSpotify.queue(uri).catch(() => undefined);
      }
      setCurrentUri(contextKey);
    },
    [connected, connectAppRemote]
  );

  const pause = useCallback(async () => {
    if (MellowSpotify) await MellowSpotify.pause();
  }, []);

  const resume = useCallback(async () => {
    if (MellowSpotify) await MellowSpotify.resume();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<SpotifyValue>(
    () => ({
      available: isMellowSpotifyAvailable,
      authorized,
      connected,
      connecting,
      error,
      nowPlaying,
      currentUri,
      connect,
      disconnect,
      playUri,
      playTracks,
      pause,
      resume,
      clearError,
    }),
    [
      authorized,
      connected,
      connecting,
      error,
      nowPlaying,
      currentUri,
      connect,
      disconnect,
      playUri,
      playTracks,
      pause,
      resume,
      clearError,
    ]
  );

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

export function useSpotify(): SpotifyValue {
  const ctx = useContext(SpotifyContext);
  if (!ctx) throw new Error('useSpotify precisa estar dentro de <SpotifyProvider>');
  return ctx;
}
