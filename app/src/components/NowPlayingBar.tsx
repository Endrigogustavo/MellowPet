import React, { useCallback, useEffect, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMusic } from '../audio/MusicPlayer';
import { ICONS, formatTime } from '../data/content';
import { useSpotify } from '../spotify/spotifyClient';
import { useApp, useTheme } from '../state/AppContext';
import { useDockInset } from './DockInset';
import { DraggableDock } from './DraggableDock';
import { NowPlayingPulse } from './NowPlayingPulse';
import { Icon } from './Icon';
import { Bar, Touchable, Txt } from './ui';

/** Alça: sinaliza que dá para arrastar, sem precisar de instrução. */
function Grabber({ color }: { color: string }) {
  return (
    <View
      style={{
        alignSelf: 'center',
        width: 34,
        height: 4,
        borderRadius: 999,
        backgroundColor: color,
        marginBottom: 9,
      }}
    />
  );
}

/**
 * Mini-player. O design o desenhava só dentro da aba Música, porque ali o áudio
 * era falso; com som de verdade ele precisa acompanhar o app inteiro, senão a
 * música continua tocando sem nenhum controle à vista. Quando o Spotify está
 * conectado, ele manda no que aparece aqui — é ele quem está tocando de fato.
 *
 * Arrastável: ficava fixo acima das abas e tapava o conteúdo. Agora sobe,
 * desce e some ao ser puxado para baixo — sem parar a música, que continua
 * tocando e volta a aparecer na próxima faixa.
 */
export function NowPlayingBar() {
  const { playlist, track, isPlaying, isBuffering, position, duration, progress, togglePlayback, skip } =
    useMusic();
  const spotify = useSpotify();
  const { actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const [dismissed, setDismissed] = useState(false);

  const spotifyTrack = spotify.connected ? (spotify.nowPlaying?.trackName ?? null) : null;
  const localTrack = track?.title ?? null;
  const currentTrack = spotifyTrack ?? localTrack;

  // Faixa nova traz o player de volta: dispensar é "some agora", não
  // "não quero mais ver isso nunca".
  useEffect(() => {
    setDismissed(false);
  }, [currentTrack]);

  const restBottom = insets.bottom + 88;

  // As telas roláveis reservam espaço para o card, senão ele flutua por cima
  // das últimas linhas e engole o toque delas.
  const { setHeight: setDockHeight } = useDockInset();
  const showsSpotify = spotify.connected && !!spotify.nowPlaying?.trackName && !dismissed;
  const showsLocal = !showsSpotify && !!playlist && !!track && !dismissed;
  const visible = showsSpotify || showsLocal;

  useEffect(() => {
    if (!visible) setDockHeight(0);
  }, [visible, setDockHeight]);

  const measure = useCallback(
    (e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      setDockHeight((prev) => (prev === h ? prev : h));
    },
    [setDockHeight]
  );

  const expandSpotify = useCallback(() => actions.go('spotifyplayer'), [actions]);
  const expandLocal = useCallback(() => actions.go('music'), [actions]);
  const dismiss = useCallback(() => setDismissed(true), []);

  if (spotify.connected && spotify.nowPlaying?.trackName) {
    if (dismissed) return null;
    const np = spotify.nowPlaying;
    return (
      <DraggableDock
        restBottom={restBottom}
        onExpand={expandSpotify}
        onDismiss={dismiss}
        onLayout={measure}
      >
      <Touchable
        onPress={() => actions.go('spotifyplayer')}
        accessibilityLabel="Abrir player do Spotify"
        style={{
          borderRadius: 20,
          padding: 12,
          paddingHorizontal: 14,
          backgroundColor: T.surf,
          borderWidth: 1,
          borderColor: T.bd,
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Grabber color={T.bd} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: 'rgba(29,185,84,.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {np.isPaused ? (
              <Icon d={ICONS.spotify} size={17} color="#1DB954" />
            ) : (
              <NowPlayingPulse playing color="#1DB954" size={17} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Txt s={13.5} w={800} c={T.t1} numberOfLines={1}>
              {np.trackName}
            </Txt>
            <Txt s={11.5} c={T.t3} numberOfLines={1}>
              {np.artistName ?? 'Spotify'}
            </Txt>
          </View>

          <Touchable
            onPress={spotify.skipNext}
            accessibilityLabel="Próxima faixa"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={['M6 5.5l9 6.5-9 6.5z', 'M18 6v12']} size={15} color={T.t2} sw={2} />
          </Touchable>

          <Touchable
            onPress={() => (np.isPaused ? spotify.resume() : spotify.pause())}
            accessibilityLabel={np.isPaused ? 'Tocar' : 'Pausar'}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: T.bd,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              d={np.isPaused ? ICONS.playFill : ICONS.pause}
              size={14}
              color={T.t1}
              sw={2.2}
              filled={np.isPaused}
            />
          </Touchable>
        </View>
      </Touchable>
      </DraggableDock>
    );
  }

  if (!playlist || !track || dismissed) return null;

  return (
    <DraggableDock
      restBottom={restBottom}
      onExpand={expandLocal}
      onDismiss={dismiss}
      onLayout={measure}
    >
    <View
      style={{
        borderRadius: 20,
        padding: 12,
        paddingHorizontal: 14,
        backgroundColor: T.surf,
        borderWidth: 1,
        borderColor: T.bd,
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}
    >
      <Grabber color={T.bd} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            backgroundColor: playlist.c,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isPlaying ? (
            <NowPlayingPulse playing color="#fff" size={17} />
          ) : (
            <Icon d={ICONS.note} size={17} color="#fff" sw={2} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Txt s={13.5} w={800} c={T.t1} numberOfLines={1}>
            {track.title}
          </Txt>
          <Txt s={11.5} c={T.t3} numberOfLines={1}>
            {isBuffering ? 'carregando…' : `${track.artist} · ${playlist.name}`}
          </Txt>
        </View>

        <Touchable
          onPress={skip}
          accessibilityLabel="Próxima faixa"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={['M6 5.5l9 6.5-9 6.5z', 'M18 6v12']} size={15} color={T.t2} sw={2} />
        </Touchable>

        <Touchable
          onPress={togglePlayback}
          accessibilityLabel={isPlaying ? 'Pausar' : 'Tocar'}
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: T.bd,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            d={isPlaying ? ICONS.pause : ICONS.playFill}
            size={14}
            color={T.t1}
            sw={2.2}
            filled={!isPlaying}
          />
        </Touchable>
      </View>

      <View style={{ marginTop: 11 }}>
        <Bar pct={progress * 100} color={playlist.c} height={4} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Txt s={10} c={T.t3}>
          {formatTime(position)}
        </Txt>
        <Txt s={10} c={T.t3}>
          {formatTime(duration)}
        </Txt>
      </View>
    </View>
    </DraggableDock>
  );
}
