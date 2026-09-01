import React from 'react';

import { useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';
import { Card, Touchable, Txt } from './ui';

/** Reutilizado quando a busca dos vínculos falha, sem confundir com lista vazia. */
export function CareLinksErrorCard({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { T } = useTheme();
  return (
    <Card radius={24} padding={20} style={{ borderColor: DANGER }}>
      <Txt s={14.5} w={800} c={DANGER} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        Não foi possível carregar as conexões
      </Txt>
      <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
        {error.message}
      </Txt>
      <Touchable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Tentar carregar as conexões novamente"
        style={{ alignSelf: 'flex-start', marginTop: 12 }}
      >
        <Txt s={12.5} w={800} c={T.pri}>Tentar novamente</Txt>
      </Touchable>
    </Card>
  );
}
