import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

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
import {
  forgetCachedUser,
} from './spotifyApi';

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
  skipNext: () => Promise<void>;
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

  const connectAppRemote = useCallback(async (): Promise<boolean> => {
    if (!MellowSpotify) return false;
    try {
      await MellowSpotify.connect(CLIENT_ID, SPOTIFY_REDIRECT_URI);
      setConnected(true);
      setError(null);
      return true;
    } catch (err) {
      setConnected(false);
      const message = err instanceof Error ? err.message : 'Não foi possível conectar ao Spotify.';
      setError(message);
      return false;
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

  /** Enquanto o navegador de autorização está aberto. Se a pessoa voltar ao
   * app sem completar (botão voltar, trocar de app, fechar a aba), nenhum
   * deep link chega — sem isto o botão ficava "conectando..." travado pra
   * sempre, exigindo reinstalar o app pra sair do estado. */
  const awaitingBrowserRef = useRef(false);
  const backoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearBackoutTimer = useCallback(() => {
    if (backoutTimerRef.current) {
      clearTimeout(backoutTimerRef.current);
      backoutTimerRef.current = null;
    }
  }, []);

  /** Retorno do consentimento no navegador. */
  useEffect(() => {
    const handleUrl = (url: string) => {
      clearBackoutTimer();
      awaitingBrowserRef.current = false;
      completeSpotifyAuth(url)
        .then(async (tokens) => {
          if (!tokens) return;
          setAuthorized(true);
          setError(null);
          await connectAppRemote();
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
  }, [clearBackoutTimer, connectAppRemote]);

  // Volta ao app sem o deep link ter chegado: assume que a pessoa desistiu
  // no navegador. Dá 1.5s de folga antes de destravar, porque no caminho
  // de sucesso o Android às vezes reativa a activity um instante antes de
  // entregar a intent com a URL de retorno.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !awaitingBrowserRef.current) return;
      clearBackoutTimer();
      backoutTimerRef.current = setTimeout(() => {
        if (!awaitingBrowserRef.current) return;
        awaitingBrowserRef.current = false;
        setConnecting(false);
      }, 1500);
    });
    return () => {
      sub.remove();
      clearBackoutTimer();
    };
  }, [clearBackoutTimer]);

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
      if (!tokens) {
        awaitingBrowserRef.current = true;
        await beginSpotifyAuth();
        return;
      }
      setAuthorized(true);
      await connectAppRemote();
      setConnecting(false);
    } catch (err) {
      awaitingBrowserRef.current = false;
      clearBackoutTimer();
      setConnecting(false);
      setError(err instanceof Error ? err.message : 'Não foi possível conectar ao Spotify.');
    }
  }, [clearBackoutTimer, connectAppRemote]);

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
      try {
        if (!MellowSpotify) return;
        if (!connected && !(await connectAppRemote())) return;
        await MellowSpotify.play(uri);
        setCurrentUri(uri);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível tocar no Spotify.');
      }
    },
    [connected, connectAppRemote]
  );

  const playTracks = useCallback(
    async (uris: string[], contextKey: string) => {
      if (uris.length === 0) return;
      try {
        if (!MellowSpotify) return;
        if (!connected && !(await connectAppRemote())) return;
        await MellowSpotify.play(uris[0]);
        for (const uri of uris.slice(1)) await MellowSpotify.queue(uri);
        setCurrentUri(contextKey);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível tocar no Spotify.');
      }
    },
    [connected, connectAppRemote]
  );

  const pause = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.pause();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível pausar no Spotify.');
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.resume();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível retomar no Spotify.');
    }
  }, []);

  const skipNext = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.skipNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível avançar no Spotify.');
    }
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
      skipNext,
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
      skipNext,
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
