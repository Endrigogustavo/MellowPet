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
  getMyProfile,
  type SpotifyProfile,
} from './spotifyApi';
import { updateNowPlayingWidget } from '../widgets/widgetBridge';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

export const SPOTIFY_CONFIGURED = isMellowSpotifyAvailable && SPOTIFY_CLIENT_CONFIGURED;

type NowPlaying = {
  trackName: string | null;
  artistName: string | null;
  trackUri: string | null;
  isPaused: boolean;
  positionMs: number;
  durationMs: number;
};

/** O SDK do App Remote devolve códigos técnicos em inglês — isto traduz os
 * que realmente aparecem na prática pra algo que a pessoa consegue agir. */
function friendlySpotifyError(raw: string): string {
  if (raw.includes('cant_play_on_demand')) {
    return 'Sua conta Spotify é Free — o Spotify só deixa apps de terceiros tocarem uma playlist inteira embaralhada, não escolher uma faixa exata. Toque a playlist inteira, ou assine o Premium para escolher faixas.';
  }
  if (raw.includes('CouldNotFindSpotifyApp') || raw.includes('not installed')) {
    return 'Instale o app do Spotify para tocar as playlists.';
  }
  if (raw.includes('UserNotAuthorizedException') || raw.includes('Explicit user authorization')) {
    return 'Sua conta ainda não autorizou o MellowPet no Spotify. Toque em Conectar Spotify.';
  }
  if (raw.includes('NotLoggedInException') || raw.includes('not logged in')) {
    return 'Entre na sua conta no app do Spotify e tente de novo.';
  }
  if (raw.includes('SpotifyDisconnectedException') || raw.includes('not connected')) {
    return 'A conexão com o Spotify caiu. Toque em Conectar Spotify de novo.';
  }
  if (raw.includes('OfflineModeException') || raw.includes('offline')) {
    return 'O Spotify está em modo offline. Verifique sua internet.';
  }
  return raw;
}

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
  skipPrevious: () => Promise<void>;
  /** Nome e tipo de conta (Free/Premium) — null até autorizar e a busca
   * completar; nunca bloqueia nada, é só informativo. */
  profile: SpotifyProfile | null;
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
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);

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
      setError(friendlySpotifyError(message));
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

  // Nome e Free/Premium só servem pra exibir — uma falha aqui não deve virar
  // erro visível, então fica de fora do fluxo principal de conectar.
  useEffect(() => {
    if (!authorized) {
      setProfile(null);
      return;
    }
    getMyProfile()
      .then(setProfile)
      .catch(() => undefined);
  }, [authorized]);

  // Widget "Música" na tela inicial do celular.
  useEffect(() => {
    const duration = nowPlaying?.durationMs ?? 0;
    updateNowPlayingWidget({
      track: nowPlaying?.trackName ?? null,
      artist: nowPlaying?.artistName ?? null,
      isPaused: nowPlaying?.isPaused ?? true,
      source: 'SPOTIFY',
      progress: duration > 0 ? Math.round(((nowPlaying?.positionMs ?? 0) / duration) * 100) : 0,
    });
  }, [nowPlaying]);

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
          positionMs: event.positionMs,
          durationMs: event.durationMs,
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
      const message = err instanceof Error ? err.message : 'Não foi possível conectar ao Spotify.';
      setError(friendlySpotifyError(message));
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
    setProfile(null);
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
        const message = err instanceof Error ? err.message : 'Não foi possível tocar no Spotify.';
        setError(friendlySpotifyError(message));
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
        const message = err instanceof Error ? err.message : 'Não foi possível tocar no Spotify.';
        setError(friendlySpotifyError(message));
      }
    },
    [connected, connectAppRemote]
  );

  const pause = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.pause();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível pausar no Spotify.';
      setError(friendlySpotifyError(message));
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.resume();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível retomar no Spotify.';
      setError(friendlySpotifyError(message));
    }
  }, []);

  const skipNext = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.skipNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível avançar no Spotify.';
      setError(friendlySpotifyError(message));
    }
  }, []);

  const skipPrevious = useCallback(async () => {
    try {
      if (MellowSpotify) await MellowSpotify.skipPrevious();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível voltar no Spotify.';
      setError(friendlySpotifyError(message));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /** Botões do widget "Tocando agora" — abrem o app com essa URL, que o
   * widget nunca consegue interpretar sozinho (ele não fala com o Spotify). */
  useEffect(() => {
    const handleWidgetUrl = (url: string) => {
      if (!url.startsWith('mellowpet://widget/spotify')) return;
      const [, query] = url.split('?');
      const action = new URLSearchParams(query ?? '').get('action');
      if (action === 'pause') pause();
      else if (action === 'resume') resume();
      else if (action === 'next') skipNext();
      else if (action === 'previous') skipPrevious();
    };
    Linking.getInitialURL().then((url) => {
      if (url) handleWidgetUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleWidgetUrl(url));
    return () => sub.remove();
  }, [pause, resume, skipNext, skipPrevious]);

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
      skipPrevious,
      profile,
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
      skipPrevious,
      profile,
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
