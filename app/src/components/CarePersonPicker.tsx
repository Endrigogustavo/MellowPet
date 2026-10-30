import React, { useEffect } from 'react';
import { View } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { careName, pickCurrent } from '../care/careSelection';
import { useApp, useTheme } from '../state/AppContext';
import { Touchable, Txt } from './ui';

/**
 * Seletor compartilhado entre as áreas do cuidador. Mostra TODOS os vínculos
 * (quem não tem nome aparece como "Pessoa acompanhada N") e só corrige a
 * escolha quando a pessoa escolhida deixou de existir — nunca troca uma
 * escolha válida por conta própria.
 */
export function CarePersonPicker({ links }: { links: CaregiverLink[] }) {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const selected = pickCurrent(links, state.person);

  useEffect(() => {
    if (selected && selected.id !== state.person) actions.set({ person: selected.id });
  }, [actions, selected, state.person]);

  if (links.length < 2) return null;

  return (
    <View accessibilityLabel="Pessoa acompanhada" style={{ marginHorizontal: 20, marginBottom: 14 }}>
      <Txt s={11} w={800} c={T.t3} ls={1.2}>
        PESSOA ACOMPANHADA
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {links.map((link) => {
          const isSelected = link.id === selected?.id;
          const name = careName(link, links);
          return (
            <Touchable
              key={link.id}
              onPress={() => actions.set({ person: link.id })}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar ${name}`}
              accessibilityState={{ selected: isSelected }}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderRadius: 13,
                backgroundColor: isSelected ? T.priL : T.surf,
                borderWidth: 1,
                borderColor: isSelected ? T.pri : T.bd,
              }}
            >
              <Txt s={12.5} w={800} c={isSelected ? T.pri : T.t2}>
                {name}
              </Txt>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}
