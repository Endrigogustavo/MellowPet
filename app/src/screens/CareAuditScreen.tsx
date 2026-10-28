import React from 'react';

import { auditActionLabel } from '../care/careAudit';
import { listCareAuditEntries } from '../care/careClient';
import { formatInDeviceTimeZone } from '../care/careDateTime';
import { useCareResource } from '../care/useCareResource';
import { CareGate, ErrorCard, LoadingCard, useCurrentCareLink } from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Txt } from '../components/ui';
import { useTheme } from '../state/AppContext';
import { OK } from '../theme/palette';

export function CareAuditScreen() {
  const { T } = useTheme();
  const care = useCurrentCareLink();
  const cared = care.current?.cared_user_id ?? null;
  const entries = useCareResource(cared, () => listCareAuditEntries(cared!));

  return (
    <ScreenScroll>
      <ScreenTitle label="HISTÓRICO" title={care.name ? `Cuidado de\n${care.name}` : 'Histórico de\ncuidado'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para consultar o histórico.">
        {() =>
          entries.error ? (
            <Section top={0}>
              <ErrorCard title="Não foi possível carregar o histórico" error={entries.error} onRetry={entries.refresh} />
            </Section>
          ) : entries.data === null ? (
            <Section top={0}>
              <LoadingCard text="Carregando histórico…" />
            </Section>
          ) : (
            <>
              <Section top={0}>
                <Card radius={24} padding={18}>
                  <Txt s={11} w={800} c={T.pri} ls={1.1}>
                    REGISTRO OPERACIONAL
                  </Txt>
                  <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
                    Aqui aparecem apenas a categoria e o horário das alterações. Conteúdo de notas, check-ins, alertas,
                    respostas, sinais e evidências não é exibido.
                  </Txt>
                </Card>
              </Section>
              {entries.data.length === 0 ? (
                <Section>
                  <Card radius={24} padding={21}>
                    <Txt s={15} w={800} c={OK}>
                      Nenhuma alteração registrada
                    </Txt>
                    <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
                      Quando houver uma alteração importante, ela aparecerá aqui sem expor o conteúdo do cuidado.
                    </Txt>
                  </Card>
                </Section>
              ) : (
                <Section gap={10}>
                  {entries.data.map((entry) => (
                    <Card key={entry.id} radius={20} padding={16}>
                      <Txt s={14} w={800} c={T.t1}>
                        {auditActionLabel(entry.action)}
                      </Txt>
                      <Txt s={11.5} c={T.t3} style={{ marginTop: 5 }}>
                        {formatInDeviceTimeZone(entry.created_at)}
                      </Txt>
                    </Card>
                  ))}
                </Section>
              )}
            </>
          )
        }
      </CareGate>
    </ScreenScroll>
  );
}
