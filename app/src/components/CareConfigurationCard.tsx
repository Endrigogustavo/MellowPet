import React from 'react';

import { Card, Touchable, Txt } from './ui';
import { useApp, useTheme } from '../state/AppContext';

/** Safe empty state used by caregiver tools until their Supabase migration exists. */
export function CareConfigurationCard({ feature = 'este recurso' }: { feature?: string }) {
  const { T } = useTheme();
  const { actions } = useApp();
  return (
    <Card radius={24} padding={20} style={{ borderColor: T.pri }}>
      <Txt s={14.5} w={800} c={T.t1}>Configuração do cuidador pendente</Txt>
      <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
        {feature} será habilitado depois que a migration do módulo de cuidado for aplicada no Supabase. Nenhuma informação é inventada ou armazenada localmente enquanto isso.
      </Txt>
      <Touchable
        onPress={() => actions.go('careguide')}
        accessibilityRole="button"
        accessibilityLabel="Abrir guia do cuidador"
        accessibilityHint="Explica consentimento e os limites do acompanhamento."
        style={{ alignSelf: 'flex-start', marginTop: 12 }}
      >
        <Txt s={12.5} w={800} c={T.pri}>Abrir guia do cuidador</Txt>
      </Touchable>
    </Card>
  );
}
