import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt, useColumnWidth } from '../components/ui';
import { listFriends, type Friend } from '../pet/encounters';
import { STAGE_LABEL } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';

/**
 * Álbum dos pets que o seu pet conheceu pessoalmente.
 *
 * Cada encontro vira uma lembrança. Repetir o mesmo amigo em outro dia soma
 * no cartão daquele pet.
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
      <ScreenTitle label="Encontros" title="Álbum de amigos" />

      {error ? (
        <Section top={0}>
          <Txt s={12.5} lh={1.5} c={T.danger}>
            {error}
          </Txt>
        </Section>
      ) : null}

      {!state.encountersEnabled ? (
        <Section top={0}>
          <Card radius={22} padding={18}>
            <Txt s={13.5} lh={1.55} c={T.t2}>
              Os encontros estão desligados. Ative para o seu Mellow conhecer os pets de quem estiver por perto.
            </Txt>
            <PrimaryButton
              label="Ativar encontros"
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
          <Card variant="warm" radius={22} padding={20} style={{ alignItems: 'center' }}>
            <Txt s={14} w={800} c={T.t1} center>
              Nenhum encontro registrado ainda
            </Txt>
            <Txt s={12.5} lh={1.55} c={T.t2} center style={{ marginTop: 6 }}>
              Quando duas pessoas abrem o MellowPet por perto com encontros ativos, os pets se cumprimentam e ficam guardados aqui.
            </Txt>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {groups.map((g) => (
              <Card key={g.key} radius={18} padding={12} style={{ width: cell, alignItems: 'center' }}>
                <PetFace size={58} petType={g.friend.petType} emotion="happy" stage={g.friend.stage} />
                <Txt s={12.5} w={800} c={T.t1} numberOfLines={1} style={{ marginTop: 6, maxWidth: '100%' }}>
                  {g.friend.petName}
                </Txt>
                <Txt s={11} c={T.t3} numberOfLines={1}>
                  {STAGE_LABEL[g.friend.stage]} ({g.times}x)
                </Txt>
              </Card>
            ))}
          </View>
        )}
      </Section>
    </ScreenScroll>
  );
}
