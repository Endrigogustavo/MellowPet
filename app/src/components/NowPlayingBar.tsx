import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMusic } from '../audio/MusicPlayer';
import { ICONS, formatTime } from '../data/content';
import { useTheme } from '../state/AppContext';
import { Icon } from './Icon';
import { Bar, Touchable, Txt } from './ui';

/**
 * Mini-player. O design o desenhava só dentro da aba Música, porque ali o áudio
 * era falso; com som de verdade ele precisa acompanhar o app inteiro, senão a
 * música continua tocando sem nenhum controle à vista.
 */
export function NowPlayingBar() {
  const { playlist, track, isPlaying, isBuffering, position, duration, progress, togglePlayback, skip } =
    useMusic();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  if (!playlist || !track) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 88,
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
          <Icon d={ICONS.note} size={17} color="#fff" sw={2} />
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
  );
}
