import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt, useColumnWidth } from '../components/ui';
import { listFriends, type Friend } from '../pet/encounters';
import { STAGE_LABEL } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

/**
 * Álbum dos pets que o seu pet conheceu pessoalmente.
 *
 * Cada encontro vira uma figurinha. Repetir o mesmo amigo em outro dia é bom
 * sinal (vocês se viram de novo), então a lista agrupa pelo cartão do pet e
 * mostra quantas vezes se encontraram.
 */
type Group = { key: string; friend: Friend; times: number };

function group(friends: Friend[]): Group[] {
  const map = new Map<string, Group>();
  friends.forEach((f) => {
    const key = `${f.petName}|${f.petType}`;
    const g = map.get(key);
    if (g) g.times += 1;
    else map.set(key, { key, friend: f, times: 1 });
  });
  return [...map.values()];
}

export function FriendsScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cell = useColumnWidth(3, 10);

  useEffect(() => {
    if (!state.userId) return;
    listFriends(state.userId)
      .then(setFriends)
      .catch((e: Error) => setError(e.message));
  }, [state.userId]);

  const groups = friends ? group(friends) : [];

  return (
    <ScreenScroll>
      <ScreenTitle label="ENCONTROS" title={`Amigos do\n${state.petName}`} />

      {error ? (
        <Section top={0}>
          <Txt s={12.5} lh={1.5} c={DANGER}>
            {error}
          </Txt>
        </Section>
      ) : null}

      {!state.encountersEnabled ? (
        <Section top={0}>
          <Card radius={22} padding={18}>
            <Txt s={13} lh={1.5} c={T.t2}>
              Os encontros estão desligados. Ligue para {state.petName} conhecer os pets de quem está perto de você.
            </Txt>
            <PrimaryButton
              label="Ligar encontros"
              onPress={() => actions.setEncounters(true).catch(() => undefined)}
              style={{ marginTop: 12 }}
            />
          </Card>
        </Section>
      ) : null}

      <Section top={14}>
        {friends === null && !error ? (
          <ActivityIndicator color={T.pri} style={{ marginTop: 20 }} />
        ) : groups.length === 0 ? (
          <Txt s={12.5} lh={1.5} c={T.t3}>
            Ninguém ainda. Abra o app na Home perto de alguém que também usa o MellowPet.
          </Txt>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {groups.map((g) => (
              <Card key={g.key} radius={18} padding={10} style={{ width: cell, alignItems: 'center' }}>
                <PetFace size={58} petType={g.friend.petType} emotion="happy" stage={g.friend.stage} />
                <Txt s={12.5} w={800} c={T.t1} numberOfLines={1} style={{ marginTop: 4 }}>
                  {g.friend.petName}
                </Txt>
                <Txt s={10.5} c={T.t3}>
                  {STAGE_LABEL[g.friend.stage]} · {g.times}×
                </Txt>
              </Card>
            ))}
          </View>
        )}
      </Section>
    </ScreenScroll>
  );
}
