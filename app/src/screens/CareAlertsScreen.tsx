import React, { useState } from 'react';
import { View } from 'react-native';

import { createSupportAction, listCareAlerts, updateCareAlert } from '../care/careClient';
import { formatInDeviceTimeZone } from '../care/careDateTime';
import type { CareAlert } from '../care/careTypes';
import { FEEDBACK_LABEL, giveAlertFeedback, type AlertFeedback } from '../care/presenceClient';
import { Icon } from '../components/Icon';
import { EXTRA_ICONS } from '../data/content';
import { useCareResource } from '../care/useCareResource';
import { ActionError, CareGate, CareLinkButton, ErrorCard, LoadingCard, StaleNotice, useCurrentCareLink } from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN } from '../theme/palette';

const STATUS_LABEL: Record<CareAlert['status'], string> = {
  open: 'NOVO ALERTA',
  acknowledged: 'EM ACOMPANHAMENTO',
  resolved: 'RESOLVIDO',
};

export function CareAlertsScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const care = useCurrentCareLink();
  const cared = care.current?.cared_user_id ?? null;
  const alerts = useCareResource(cared, () => listCareAlerts(cared!));
  // Trava por alerta: dois toques não registram a ação duas vezes.
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const change = async (alert: CareAlert, status: 'acknowledged' | 'resolved', feedback?: AlertFeedback) => {
    if (!state.userId || busy || !care.current?.cared_user_id) return;
    setBusy(alert.id);
    setActionError(null);
    try {
      await updateCareAlert(alert.id, status, state.userId);
      alerts.setData((items) => items?.map((item) => (item.id === alert.id ? { ...item, status, feedback: feedback ?? item.feedback } : item)) ?? null);
      // O retorno ajusta o limiar deste vínculo (falsos alarmes deixam o
      // alerta mais exigente) e mede a precisão dos alertas.
      if (feedback) await giveAlertFeedback(alert.id, feedback).catch(() => setActionError('O alerta foi resolvido, mas o retorno não foi salvo.'));
      if (status === 'acknowledged') {
        // O alerta já mudou; se só o registro de apoio falhar, a lista fica.
        await createSupportAction(care.current.cared_user_id, care.current.id, state.userId, 'Alerta reconhecido', alert.title).catch(
          () => setActionError('O alerta foi marcado, mas não deu para registrar a ação de apoio.')
        );
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível atualizar este alerta.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="ALERTAS" title={care.name ? `Acompanhar\n${care.name}` : 'Sinais para\nacompanhar'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para acompanhar alertas.">
        {() => (
          <>
            {actionError ? (
              <Section top={0}>
                <ActionError message={actionError} onClose={() => setActionError(null)} />
              </Section>
            ) : null}
            <Section top={actionError ? 10 : 0} style={{ marginBottom: 10 }}>
              <CareLinkButton
                label="Ajustar quando avisar (regras de alerta)"
                onPress={() => actions.go('carealertrules')}
                hint="Abre as regras de alerta desta pessoa"
              />
            </Section>
            {alerts.error && alerts.data ? (
              <Section top={0} style={{ marginBottom: 10 }}>
                <StaleNotice at={alerts.updatedAt} onRetry={alerts.refresh} />
              </Section>
            ) : null}
            {alerts.error && !alerts.data ? (
              <Section top={0}>
                <ErrorCard title="Não foi possível carregar os alertas" error={alerts.error} onRetry={alerts.refresh} />
              </Section>
            ) : alerts.data === null ? (
              <Section top={0}>
                <LoadingCard text="Carregando alertas…" />
              </Section>
            ) : alerts.data.length === 0 ? (
              <Section top={0}>
                <Card radius={24} padding={21}>
                  <Txt s={15} w={800} c={OK}>
                    Nenhum alerta registrado
                  </Txt>
                  <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
                    A ausência de alertas não resume o bem-estar da pessoa. Continue usando check-ins e o plano de cuidado.
                  </Txt>
                </Card>
              </Section>
            ) : (
              <Section top={0} gap={10}>
                {alerts.data.map((alert) => {
                  const color = alert.severity === 'urgent' ? DANGER : alert.severity === 'attention' ? WARN : T.pri;
                  const working = busy === alert.id;
                  return (
                    <Card key={alert.id} radius={22} padding={17} style={{ borderColor: alert.status === 'resolved' ? T.bd : color }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {alert.status !== 'resolved' ? <Icon d={EXTRA_ICONS.warning} size={14} color={color} sw={2} /> : null}
                            <Txt s={11} w={800} c={color} ls={1.1}>
                              {STATUS_LABEL[alert.status]}
                            </Txt>
                          </View>
                          <Txt s={15} w={800} c={T.t1} style={{ marginTop: 5 }}>
                            {alert.title}
                          </Txt>
                        </View>
                        <Txt s={11} c={T.t3}>
                          {formatInDeviceTimeZone(alert.occurred_at)}
                        </Txt>
                      </View>
                      <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 8 }}>
                        {alert.detail}
                      </Txt>
                      <Txt s={11} lh={1.45} c={T.t3} style={{ marginTop: 9 }}>
                        Um alerta descreve um padrão de sinais e não uma emergência ou diagnóstico por si só.
                      </Txt>
                      {alert.status === 'open' ? (
                        <View style={{ flexDirection: 'row', gap: 9, marginTop: 13 }}>
                          <Touchable
                            onPress={() => change(alert, 'acknowledged')}
                            disabled={working}
                            accessibilityRole="button"
                            style={{ paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12, backgroundColor: T.priL, opacity: working ? 0.5 : 1 }}
                          >
                            <Txt s={12} w={800} c={T.pri}>
                              {working ? 'Marcando…' : 'Marcar como visto'}
                            </Txt>
                          </Touchable>
                          <Touchable onPress={() => actions.go('careplan')} accessibilityRole="button" style={{ paddingVertical: 10, paddingHorizontal: 13 }}>
                            <Txt s={12} w={800} c={T.t2}>
                              Ver plano
                            </Txt>
                          </Touchable>
                        </View>
                      ) : alert.status === 'acknowledged' ? (
                        <View style={{ marginTop: 13 }}>
                          <Txt s={11.5} w={800} c={T.t2}>
                            Resolver — este alerta foi:
                          </Txt>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                            {(Object.keys(FEEDBACK_LABEL) as AlertFeedback[]).map((f) => (
                              <Touchable
                                key={f}
                                onPress={() => change(alert, 'resolved', f)}
                                disabled={working}
                                accessibilityRole="button"
                                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: T.priL, opacity: working ? 0.5 : 1 }}
                              >
                                <Txt s={12} w={800} c={T.pri}>
                                  {FEEDBACK_LABEL[f]}
                                </Txt>
                              </Touchable>
                            ))}
                          </View>
                        </View>
                      ) : alert.feedback ? (
                        <Txt s={11} c={OK} style={{ marginTop: 10 }}>
                          Resolvido · {FEEDBACK_LABEL[alert.feedback]}
                        </Txt>
                      ) : null}
                    </Card>
                  );
                })}
              </Section>
            )}
          </>
        )}
      </CareGate>
    </ScreenScroll>
  );
}
