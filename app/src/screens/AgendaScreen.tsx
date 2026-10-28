import React, { useState } from 'react';
import { View } from 'react-native';

import { createCareAppointment, createCareCheckin, listCareAppointments, listCareCheckins, type CaregiverLink } from '../care/careClient';
import {
  deviceTimeZone,
  formatInDeviceTimeZone,
  localDateTimeInput,
  parseDeviceLocalDateTime,
  validateDateRange,
} from '../care/careDateTime';
import { useCareResource } from '../care/useCareResource';
import { CareGate, ErrorCard, LoadingCard, useCurrentCareLink } from '../components/CareStates';
import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

type Message = { text: string; tone: 'ok' | 'error' };

/** Data/hora digitada, já validada e no FUTURO. */
function futureIso(value: string): { iso?: string; error?: string } {
  const parsed = parseDeviceLocalDateTime(value);
  if (!parsed.iso) return { error: parsed.error ?? 'Informe uma data válida.' };
  if (new Date(parsed.iso).getTime() < Date.now() - 60_000) return { error: 'Escolha um horário no futuro.' };
  return { iso: parsed.iso };
}

export function AgendaScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="AGENDA" title={care.name ? `Ritmo de\n${care.name}` : 'Ritmo e\ncheck-ins'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para organizar check-ins.">
        {(current) => <Agenda key={current.id} link={current} />}
      </CareGate>
    </ScreenScroll>
  );
}

function Agenda({ link }: { link: CaregiverLink }) {
  const { state } = useApp();
  const { T } = useTheme();
  const cared = link.cared_user_id;
  const agenda = useCareResource(cared, async () => {
    const [checkins, appointments] = await Promise.all([listCareCheckins(cared!), listCareAppointments(cared!)]);
    return { checkins, appointments };
  });
  const [prompt, setPrompt] = useState('Como você gostaria de estar agora?');
  const [checkinAt, setCheckinAt] = useState(localDateTimeInput());
  const [appointment, setAppointment] = useState('');
  const [appointmentAt, setAppointmentAt] = useState(localDateTimeInput(2));
  const [message, setMessage] = useState<Message | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'checkin' | 'appointment' | null>(null);

  if (agenda.error) {
    return (
      <Section top={0}>
        <ErrorCard title="Não foi possível carregar a agenda" error={agenda.error} onRetry={agenda.refresh} />
      </Section>
    );
  }
  if (!agenda.data || !cared || !state.userId) {
    return (
      <Section top={0}>
        <LoadingCard text="Carregando agenda…" />
      </Section>
    );
  }
  const userId = state.userId;
  const now = Date.now();
  // Só os próximos: check-ins antigos "agendados" ocupavam as vagas e o recém-criado sumia.
  const upcoming = agenda.data.checkins
    .filter((c) => c.status === 'scheduled' && new Date(c.scheduled_for).getTime() >= now - 3600_000)
    .slice(0, 6);
  const nextAppointments = agenda.data.appointments
    .filter((a) => new Date(a.ends_at ?? a.starts_at).getTime() >= now - 3600_000)
    .slice(0, 6);

  const run = async (kind: 'checkin' | 'appointment', job: () => Promise<string>) => {
    if (saving) return;
    setSaving(kind);
    try {
      setMessage({ text: await job(), tone: 'ok' });
      await agenda.refresh();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Não foi possível salvar.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const scheduleCheckin = () => {
    const when = futureIso(checkinAt);
    if (!when.iso) {
      setCheckinError(when.error!);
      return;
    }
    const question = prompt.trim();
    if (!question) {
      setMessage({ text: 'Escreva uma pergunta antes de agendar.', tone: 'error' });
      return;
    }
    setCheckinError(null);
    run('checkin', async () => {
      await createCareCheckin(cared, link.id, question, when.iso!, userId);
      return 'Check-in agendado.';
    });
  };

  const scheduleAppointment = () => {
    const when = futureIso(appointmentAt);
    if (!when.iso) {
      setAppointmentError(when.error!);
      return;
    }
    const title = appointment.trim();
    if (!title) {
      setMessage({ text: 'Dê um título ao compromisso.', tone: 'error' });
      return;
    }
    setAppointmentError(null);
    setAppointment('');
    run('appointment', async () => {
      await createCareAppointment(cared, link.id, title, when.iso!, userId);
      return 'Compromisso salvo.';
    });
  };

  const tz = `Horário deste aparelho (${deviceTimeZone()}).`;
  return (
    <>
      {message ? (
        <Section top={0}>
          <Card radius={18} padding={13} style={{ borderColor: message.tone === 'ok' ? OK : DANGER }}>
            <Txt s={12.5} c={message.tone === 'ok' ? OK : DANGER} accessibilityLiveRegion="polite">
              {message.text}
            </Txt>
          </Card>
        </Section>
      ) : null}

      <Section top={message ? 10 : 0}>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1}>
            Novo check-in
          </Txt>
          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
            Um convite para conversar — não é cobrança nem monitoramento automático.
          </Txt>
          <Field label="Pergunta" value={prompt} onChangeText={setPrompt} maxLength={200} style={{ marginTop: 12 }} />
          <Field
            label="Quando (AAAA-MM-DD HH:mm)"
            value={checkinAt}
            onChangeText={(value) => {
              setCheckinAt(value);
              setCheckinError(null);
            }}
            error={checkinError}
            hint={tz}
            maxLength={16}
          />
          <PrimaryButton
            label={saving === 'checkin' ? 'Agendando…' : 'Agendar check-in'}
            disabled={saving !== null}
            onPress={scheduleCheckin}
            style={{ marginTop: 10 }}
          />
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1}>
            Próximos check-ins
          </Txt>
          <View style={{ gap: 9, marginTop: 11 }}>
            {upcoming.length === 0 ? (
              <Txt s={12.5} c={T.t3}>
                Nenhum check-in marcado para os próximos dias.
              </Txt>
            ) : (
              upcoming.map((item) => (
                <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}>
                  <Txt s={12.5} w={800} c={T.t1}>
                    {item.prompt}
                  </Txt>
                  <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
                    {formatInDeviceTimeZone(item.scheduled_for)}
                  </Txt>
                </View>
              ))
            )}
          </View>
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1}>
            Compromissos
          </Txt>
          <Field label="Título" value={appointment} onChangeText={setAppointment} maxLength={120} style={{ marginTop: 12 }} />
          <Field
            label="Início (AAAA-MM-DD HH:mm)"
            value={appointmentAt}
            onChangeText={(value) => {
              setAppointmentAt(value);
              setAppointmentError(null);
            }}
            error={appointmentError}
            hint={tz}
            maxLength={16}
          />
          <PrimaryButton
            label={saving === 'appointment' ? 'Salvando…' : 'Salvar compromisso'}
            disabled={saving !== null}
            onPress={scheduleAppointment}
            style={{ marginTop: 10 }}
          />
          <View style={{ gap: 9, marginTop: 14 }}>
            {nextAppointments.length === 0 ? (
              <Txt s={12.5} c={T.t3}>
                Nenhum compromisso próximo.
              </Txt>
            ) : (
              nextAppointments.map((item) => {
                const intervalError = validateDateRange(item.starts_at, item.ends_at);
                return (
                  <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}>
                    <Txt s={12.5} w={800} c={T.t1}>
                      {item.title}
                    </Txt>
                    <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
                      {formatInDeviceTimeZone(item.starts_at)}
                      {item.ends_at ? ` → ${formatInDeviceTimeZone(item.ends_at)}` : ''}
                    </Txt>
                    {intervalError ? (
                      <Txt s={11} c={DANGER} style={{ marginTop: 3 }}>
                        {intervalError}
                      </Txt>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </Card>
      </Section>
    </>
  );
}
