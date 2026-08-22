import React from 'react';

import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Txt } from '../components/ui';
import { useTheme } from '../state/AppContext';

export function AgendaScreen() {
  const { T } = useTheme();

  return (
    <ScreenScroll>
      <ScreenTitle label="AGENDA" title={'O que vem\npela frente'} />

      <Section top={0}>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1}>
            Nenhum compromisso agendado ainda
          </Txt>
          <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
            Consultas e lembretes combinados com sua equipe de cuidado vão aparecer aqui.
          </Txt>
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1}>
            Equipe de cuidado
          </Txt>
          <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
            Ninguém adicionado ainda.
          </Txt>
        </Card>
      </Section>
    </ScreenScroll>
  );
}
