import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { useApp, useTheme } from '../state/AppContext';
import { Touchable, Txt } from './ui';

type CarePersonPickerProps = {
  links: CaregiverLink[];
};

/**
 * Seletor compartilhado entre as áreas do cuidador. Só apresenta nomes que
 * vieram de vínculos reais — nunca inventa uma pessoa para preencher a UI.
 */
export function CarePersonPicker({ links }: CarePersonPickerProps) {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const namedLinks = useMemo(
    () => links.filter((link) => Boolean(link.cared_name?.trim())),
    [links]
  );
  const selected = namedLinks.find((link) => link.id === state.person) ?? namedLinks[0];

  // Mantém a escolha compartilhada entre Painel, Dados, Alertas, Agenda e
  // Plano. Ao entrar em uma dessas telas, escolhe somente o primeiro vínculo
  // real quando ainda não há uma escolha válida.
  useEffect(() => {
    if (selected && selected.id !== state.person) actions.set({ person: selected.id });
  }, [actions, selected, state.person]);

  if (namedLinks.length < 2) return null;

  return (
    <View
      accessibilityLabel="Pessoa acompanhada"
      style={{ marginHorizontal: 20, marginBottom: 14 }}
    >
      <Txt s={10.5} w={800} c={T.t3} ls={1.2}>
        PESSOA ACOMPANHADA
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {namedLinks.map((link) => {
          const isSelected = link.id === selected?.id;
          const name = link.cared_name!.trim();
          return (
            <Touchable
              key={link.id}
              onPress={() => actions.set({ person: link.id })}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar ${name}`}
              accessibilityHint={isSelected ? `${name} já está selecionado.` : `Mostra os dados de ${name}.`}
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
