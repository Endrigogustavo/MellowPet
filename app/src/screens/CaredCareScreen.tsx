import React from 'react';
import { View } from 'react-native';

import { formatInDeviceTimeZone } from '../care/careDateTime';
import { fetchFromCaregivers } from '../care/careUxClient';
import { useCareResource } from '../care/useCareResource';
import { EmptyCard, ErrorCard, LoadingCard, UnavailableNotice } from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';

/**
 * "Do meu cuidador": o que o cuidador combinou para a pessoa acompanhada —
 * plano e próximos compromissos/check-ins. Somente leitura.
 */
export function CaredCareScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const userId = state.userId;
  const view = useCareResource(userId, () => fetchFromCaregivers(userId!));

  return (
    <ScreenScroll>
      <ScreenTitle label="DO MEU CUIDADOR" title={'O que foi\ncombinado'} />
      <Section top={0}>
        <Txt s={12.5} lh={1.55} c={T.t2}>
          Aqui você vê o plano de cuidado e os próximos compromissos que seu cuidador criou para você. Se algo não fizer sentido, converse com ele.
        </Txt>
      </Section>
      {!userId ? (
        <Section>
          <EmptyCard title="Entre na sua conta" text="Faça login para ver o que seu cuidador combinou." />
        </Section>
      ) : view.error && !view.data ? (
        <Section>
          <ErrorCard title="Não foi possível carregar" error={view.error} onRetry={view.refresh} />
        </Section>
      ) : !view.data ? (
        <Section>
          <LoadingCard text="Carregando…" />
        </Section>
      ) : (
        (() => {
          const { plan, appointments, checkins, failed } = view.data;
          const upcoming = appointments.filter((a) => Date.parse(a.ends_at ?? a.starts_at) >= Date.now() - 3_600_000).slice(0, 8);
          const nothing = !plan && upcoming.length === 0 && checkins.length === 0;
          return (
            <>
              {failed.length > 0 ? (
                <Section>
                  <UnavailableNotice text="Parte destas informações ainda não está disponível para você no servidor. O que carregou aparece abaixo." />
                </Section>
              ) : null}
              {nothing && failed.length === 0 ? (
                <Section>
                  <EmptyCard
                    title={state.linked ? 'Nada combinado ainda' : 'Nenhum cuidador conectado'}
                    text={
                      state.linked
                        ? 'Quando seu cuidador criar um plano ou marcar um compromisso, ele aparece aqui.'
                        : 'Para conectar, peça um código de convite ao seu cuidador.'
                    }
                    action={state.linked ? undefined : { label: 'Usar um código', onPress: () => actions.go('acceptinvite') }}
                  />
                </Section>
              ) : null}
              {plan ? (
                <Section>
                  <Card radius={24} padding={18}>
                    <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
                      {plan.title || 'Plano de cuidado'}
                    </Txt>
                    {plan.warning_signs.length > 0 ? (
                      <>
                        <Txt s={12} w={800} c={T.t2} style={{ marginTop: 12 }}>
                          Sinais que pedem uma conversa
                        </Txt>
                        {plan.warning_signs.map((s) => (
                          <Txt key={s} s={13} lh={1.5} c={T.t1} style={{ marginTop: 4 }}>
                            • {s}
                          </Txt>
                        ))}
                      </>
                    ) : null}
                    {plan.steps.length > 0 ? (
                      <>
                        <Txt s={12} w={800} c={T.t2} style={{ marginTop: 12 }}>
                          O que ajuda e próximos passos
                        </Txt>
                        {plan.steps.map((s) => (
                          <Txt key={s} s={13} lh={1.5} c={T.t1} style={{ marginTop: 4 }}>
                            • {s}
                          </Txt>
                        ))}
                      </>
                    ) : null}
                    <Txt s={11.5} c={T.t3} style={{ marginTop: 12 }}>
                      Atualizado em {new Date(plan.updated_at).toLocaleDateString('pt-BR')}
                    </Txt>
                  </Card>
                </Section>
              ) : null}
              {upcoming.length > 0 || checkins.length > 0 ? (
                <Section>
                  <Card radius={24} padding={18}>
                    <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
                      Próximos compromissos
                    </Txt>
                    <View style={{ gap: 9, marginTop: 10 }}>
                      {upcoming.map((a) => (
                        <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 9 }}>
                          <Txt s={13} w={800} c={T.t1}>
                            {a.title}
                          </Txt>
                          <Txt s={12} c={T.t3} style={{ marginTop: 2 }}>
                            {formatInDeviceTimeZone(a.starts_at)}
                          </Txt>
                        </View>
                      ))}
                      {checkins.map((c) => (
                        <View key={c.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 9 }}>
                          <Txt s={13} w={800} c={T.t1}>
                            Conversa marcada: “{c.prompt}”
                          </Txt>
                          <Txt s={12} c={T.t3} style={{ marginTop: 2 }}>
                            {formatInDeviceTimeZone(c.scheduled_for)}
                          </Txt>
                        </View>
                      ))}
                    </View>
                  </Card>
                </Section>
              ) : null}
            </>
          );
        })()
      )}
    </ScreenScroll>
  );
}
