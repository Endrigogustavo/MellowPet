import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Touchable, Txt } from '../components/ui';
import { formatTime, ICONS } from '../data/content';
import {
  getCurrentAlbumImage,
  listSpotifyDevices,
  SpotifyApiError,
  transferSpotifyPlayback,
  type SpotifyDevice,
} from '../spotify/spotifyApi';
import { useSpotify } from '../spotify/spotifyClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

/**
 * "Tocando agora" em tela cheia — o mini-player só cabe nome da faixa e dois
 * botões; aqui entra o resto: progresso, voltar faixa, dispositivos onde a
 * conta está tocando (Spotify Connect) e o tipo de conta.
 */
export function SpotifyPlayerScreen() {
  const { actions } = useApp();
  const { T } = useTheme();
  const spotify = useSpotify();
  const insets = useSafeAreaInsets();

  const np = spotify.nowPlaying;

  // O evento de estado só chega quando algo muda (play, pause, pular) — sem
  // isto a barra de progresso ficaria parada entre um evento e outro.
  const [livePosition, setLivePosition] = useState(np?.positionMs ?? 0);
  const anchorRef = useRef({ positionMs: np?.positionMs ?? 0, at: Date.now() });

  useEffect(() => {
    anchorRef.current = { positionMs: np?.positionMs ?? 0, at: Date.now() };
    setLivePosition(np?.positionMs ?? 0);
  }, [np?.positionMs, np?.trackUri]);

  useEffect(() => {
    if (!np || np.isPaused) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - anchorRef.current.at;
      setLivePosition(Math.min(anchorRef.current.positionMs + elapsed, np.durationMs));
    }, 500);
    return () => clearInterval(id);
  }, [np]);

  // O App Remote não manda capa nenhuma no evento de estado — só a Web API
  // sabe a URL da imagem da mesma faixa que já está tocando.
  const [albumImage, setAlbumImage] = useState<string | null>(null);
  useEffect(() => {
    setAlbumImage(null);
    if (!np?.trackUri) return;
    let cancelled = false;
    getCurrentAlbumImage().then((url) => {
      if (!cancelled) setAlbumImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [np?.trackUri]);

  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);

  const loadDevices = useCallback(() => {
    if (!spotify.authorized) return;
    setLoadingDevices(true);
    setDevicesError(null);
    listSpotifyDevices()
      .then(setDevices)
      .catch((err) => {
        setDevicesError(
          err instanceof SpotifyApiError ? err.message : 'Não foi possível ver os dispositivos.'
        );
      })
      .finally(() => setLoadingDevices(false));
  }, [spotify.authorized]);

  useEffect(loadDevices, [loadDevices]);

  const transfer = async (device: SpotifyDevice) => {
    setTransferringId(device.id);
    try {
      await transferSpotifyPlayback(device.id, true);
      loadDevices();
    } catch {
      setDevicesError('Não foi possível transferir a reprodução.');
    } finally {
      setTransferringId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScreenScroll>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Touchable
            onPress={() => actions.go('music')}
            accessibilityLabel="Fechar"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: T.bd,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.close} size={16} color={T.t2} sw={2} />
          </Touchable>
          <Txt s={12} w={800} c={T.t3} ls={1.5}>
            TOCANDO NO SPOTIFY
          </Txt>
          <View style={{ width: 38 }} />
        </View>

        {spotify.error ? (
          <Section top={16}>
            <Card radius={18} padding={14} style={{ backgroundColor: 'rgba(255,90,90,.1)', borderColor: 'transparent' }}>
              <Txt s={12.5} lh={1.5} c={DANGER}>
                {spotify.error}
              </Txt>
              <Touchable onPress={spotify.clearError} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <Txt s={12} w={800} c={T.t2}>
                  Dispensar
                </Txt>
              </Touchable>
            </Card>
          </Section>
        ) : null}

        {np ? (
          <>
            <Section top={36}>
              <View style={{ alignItems: 'center' }}>
                {albumImage ? (
                  <Image
                    source={{ uri: albumImage }}
                    style={{ width: 220, height: 220, borderRadius: 32 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 220,
                      height: 220,
                      borderRadius: 32,
                      backgroundColor: 'rgba(29,185,84,.14)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon d={ICONS.spotify} size={72} color="#1DB954" sw={1.6} />
                  </View>
                )}
              </View>
            </Section>

            <Section top={28}>
              <Txt s={22} w={800} c={T.t1} center numberOfLines={2}>
                {np.trackName ?? 'Carregando…'}
              </Txt>
              <Txt s={15} c={T.t3} center style={{ marginTop: 6 }}>
                {np.artistName ?? ''}
              </Txt>
            </Section>

            <Section top={24}>
              <Bar pct={np.durationMs > 0 ? (livePosition / np.durationMs) * 100 : 0} color="#1DB954" height={4} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Txt s={11} c={T.t3}>
                  {formatTime(Math.floor(livePosition / 1000))}
                </Txt>
                <Txt s={11} c={T.t3}>
                  {formatTime(Math.floor(np.durationMs / 1000))}
                </Txt>
              </View>
            </Section>

            <Section top={28}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
                <Touchable onPress={spotify.skipPrevious} accessibilityLabel="Faixa anterior">
                  <Icon d={['M18 5.5l-9 6.5 9 6.5z', 'M6 6v12']} size={22} color={T.t1} sw={2} />
                </Touchable>
                <Touchable
                  onPress={() => (np.isPaused ? spotify.resume() : spotify.pause())}
                  accessibilityLabel={np.isPaused ? 'Tocar' : 'Pausar'}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 999,
                    backgroundColor: '#1DB954',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    d={np.isPaused ? ICONS.playFill : ICONS.pause}
                    size={26}
                    color="#fff"
                    sw={2.4}
                    filled={np.isPaused}
                  />
                </Touchable>
                <Touchable onPress={spotify.skipNext} accessibilityLabel="Próxima faixa">
                  <Icon d={['M6 5.5l9 6.5-9 6.5z', 'M18 6v12']} size={22} color={T.t1} sw={2} />
                </Touchable>
              </View>
            </Section>
          </>
        ) : (
          <Section top={60}>
            <Txt s={14} c={T.t3} center lh={1.5}>
              Nada tocando agora. Volte pra aba Música e escolha algo pra ouvir.
            </Txt>
          </Section>
        )}

        {/* dispositivos */}
        <Section top={40}>
          <Card radius={22} padding={18}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt s={13.5} w={800} c={T.t1}>
                Dispositivos
              </Txt>
              <Touchable onPress={loadDevices} accessibilityLabel="Atualizar dispositivos" style={{ padding: 4 }}>
                <Icon d={['M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5', 'M18 3v4h-4', 'M6 21v-4h4']} size={16} color={T.t3} sw={2} />
              </Touchable>
            </View>
            <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
              Onde a sua conta Spotify está tocando agora — puxe para este celular.
            </Txt>

            {loadingDevices ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 }}>
                <ActivityIndicator size="small" color={T.pri} />
                <Txt s={12} c={T.t3}>
                  Procurando…
                </Txt>
              </View>
            ) : null}

            {devicesError ? (
              <Txt s={12} lh={1.45} c={DANGER} style={{ marginTop: 10 }}>
                {devicesError}
              </Txt>
            ) : null}

            {!loadingDevices && !devicesError && devices.length === 0 ? (
              <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 10 }}>
                Nenhum dispositivo Spotify ativo agora.
              </Txt>
            ) : null}

            <View style={{ marginTop: 8, gap: 2 }}>
              {devices.map((d) => (
                <View
                  key={d.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: T.bdL,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Txt s={13} w={700} c={T.t1} numberOfLines={1}>
                      {d.name}
                    </Txt>
                    <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
                      {d.type}
                      {d.isActive ? ' · tocando agora' : ''}
                    </Txt>
                  </View>
                  {d.isActive ? (
                    <Icon d={ICONS.check} size={16} color="#1DB954" sw={2.2} />
                  ) : (
                    <Touchable
                      onPress={() => transfer(d)}
                      disabled={transferringId === d.id}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 13,
                        borderRadius: 999,
                        backgroundColor: T.bg,
                        borderWidth: 1,
                        borderColor: T.bd,
                        opacity: transferringId === d.id ? 0.6 : 1,
                      }}
                    >
                      <Txt s={11.5} w={800} c={T.t1}>
                        {transferringId === d.id ? 'Transferindo…' : 'Transferir'}
                      </Txt>
                    </Touchable>
                  )}
                </View>
              ))}
            </View>
          </Card>
        </Section>

        {/* conta */}
        <Section top={12}>
          <Card
            radius={22}
            padding={16}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: 'rgba(29,185,84,.14)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon d={ICONS.spotify} size={16} color="#1DB954" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt s={13} w={700} c={T.t1} numberOfLines={1}>
                {spotify.profile?.displayName ?? 'Conta Spotify'}
              </Txt>
              <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
                {spotify.profile?.product === 'premium' ? 'Premium' : 'Free — playback limitado pelo Spotify'}
              </Txt>
            </View>
            <Touchable
              onPress={spotify.disconnect}
              style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: T.bg, borderWidth: 1, borderColor: T.bd }}
            >
              <Txt s={11.5} w={800} c={T.t2}>
                Desconectar
              </Txt>
            </Touchable>
          </Card>
        </Section>
      </ScreenScroll>
    </View>
  );
}
