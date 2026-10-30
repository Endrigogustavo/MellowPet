import React, { useState } from 'react';
import { View } from 'react-native';

import { createCareAppointment, createCareCheckin, listCareAppointments, listCareCheckins, type CaregiverLink } from '../care/careClient';
import { defaultSlot, formatInDeviceTimeZone, futureError, validateDateRange } from '../care/careDateTime';
import { isPaused } from '../care/presenceClient';
import { useCareResource } from '../care/useCareResource';
import { CareDateTimeField } from '../components/CareDateTimeField';
import { ActionMessage, CareGate, EmptyCard, ErrorCard, LoadingCard, StaleNotice, useCurrentCareLink } from '../components/CareStates';
import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

type Message = { text: string; tone: 'ok' | 'error' };

export function AgendaScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="AGENDA" title={care.name ? `Ritmo de\n${care.name}` : 'Ritmo e\ncheck-ins'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para organizar check-ins.">
        {(current, name) => <Agenda key={current.id} link={current} name={name} />}
      </CareGate>
    </ScreenScroll>
  );
}

function Agenda({ link, name }: { link: CaregiverLink; name: string }) {
  const { state } = useApp();
  const { T } = useTheme();
  const cared = link.cared_user_id;
  const paused = isPaused(link);
  const agenda = useCareResource(cared && !paused ? cared : null, async () => {
    const [checkins, appointments] = await Promise.all([listCareCheckins(cared!), listCareAppointments(cared!)]);
    return { checkins, appointments };
  });
  // Cada formulário tem seu próprio estado e sua mensagem (C4/U6): salvar um
  // não apaga o que está sendo digitado no outro.
  const [prompt, setPrompt] = useState('Como você gostaria de estar agora?');
  const [checkinAt, setCheckinAt] = useState(() => defaultSlot(1));
  const [appointment, setAppointment] = useState('');
  const [appointmentAt, setAppointmentAt] = useState(() => defaultSlot(2));
  const [checkinMsg, setCheckinMsg] = useState<Message | null>(null);
  const [appointmentMsg, setAppointmentMsg] = useState<Message | null>(null);
  const [errors, setErrors] = useState<{ prompt?: string; checkinAt?: string; title?: string; appointmentAt?: string }>({});
  const [saving, setSaving] = useState<'checkin' | 'appointment' | null>(null);

  if (paused) {
    return (
      <Section top={0}>
        <EmptyCard title="Agenda indisponível na pausa" text={`${name} pausou o compartilhamento. A agenda volta quando ela retomar.`} />
      </Section>
    );
  }
  if (agenda.error && !agenda.data) {
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
  const upcoming = agenda.data.checkins
    .filter((c) => c.status === 'scheduled' && new Date(c.scheduled_for).getTime() >= now - 3600_000)
    .slice(0, 6);
  const nextAppointments = agenda.data.appointments
    .filter((a) => new Date(a.ends_at ?? a.starts_at).getTime() >= now - 3600_000)
    .slice(0, 6);

  const scheduleCheckin = async () => {
    if (saving) return;
    const question = prompt.trim();
    const when = futureError(checkinAt);
    setErrors((e) => ({ ...e, prompt: question ? undefined : 'Escreva uma pergunta.', checkinAt: when ?? undefined }));
    if (!question || when) return;
    setSaving('checkin');
    setCheckinMsg(null);
    try {
      await createCareCheckin(cared, link.id, question, checkinAt.toISOString(), userId);
      setCheckinMsg({ text: `Check-in agendado para ${formatInDeviceTimeZone(checkinAt.toISOString())}.`, tone: 'ok' });
      setCheckinAt(defaultSlot(1));
      agenda.refresh().catch(() => undefined);
    } catch (reason) {
      setCheckinMsg({ text: reason instanceof Error ? reason.message : 'Não foi possível agendar.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const scheduleAppointment = async () => {
    if (saving) return;
    const title = appointment.trim();
    const when = futureError(appointmentAt);
    setErrors((e) => ({ ...e, title: title ? undefined : 'Dê um título ao compromisso.', appointmentAt: when ?? undefined }));
    if (!title || when) return;
    setSaving('appointment');
    setAppointmentMsg(null);
    try {
      await createCareAppointment(cared, link.id, title, appointmentAt.toISOString(), userId);
      setAppointment(''); // só limpa depois de salvar
      setAppointmentMsg({ text: 'Compromisso salvo.', tone: 'ok' });
      agenda.refresh().catch(() => undefined);
    } catch (reason) {
      setAppointmentMsg({ text: reason instanceof Error ? reason.message : 'Não foi possível salvar.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {agenda.error ? (
        <Section top={0}>
          <StaleNotice at={agenda.updatedAt} onRetry={agenda.refresh} />
        </Section>
      ) : null}
      <Section top={agenda.error ? 10 : 0}>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
            Novo check-in
          </Txt>
          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
            Um convite para conversar — não é cobrança nem monitoramento automático.
          </Txt>
          <Field
            label="Pergunta"
            value={prompt}
            onChangeText={(v) => {
              setPrompt(v);
              setErrors((e) => ({ ...e, prompt: undefined }));
            }}
            error={errors.prompt}
            maxLength={200}
            containerStyle={{ marginTop: 12 }}
          />
          <CareDateTimeField
            label="Quando"
            value={checkinAt}
            onChange={(d) => {
              setCheckinAt(d);
              setErrors((e) => ({ ...e, checkinAt: undefined }));
            }}
            error={errors.checkinAt}
          />
          <PrimaryButton label={saving === 'checkin' ? 'Agendando…' : 'Agendar check-in'} disabled={saving !== null} onPress={scheduleCheckin} style={{ marginTop: 14 }} />
          <ActionMessage message={checkinMsg} onClose={() => setCheckinMsg(null)} />
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
            Próximos check-ins
          </Txt>
          <View style={{ gap: 9, marginTop: 11 }}>
            {upcoming.length === 0 ? (
              <Txt s={12.5} lh={1.5} c={T.t3}>
                Nenhum check-in marcado. Um convite leve para conversar, uma vez por semana, já ajuda.
              </Txt>
            ) : (
              upcoming.map((item) => (
                <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}>
                  <Txt s={12.5} w={800} c={T.t1}>
                    {item.prompt}
                  </Txt>
                  <Txt s={12} c={T.t3} style={{ marginTop: 2 }}>
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
          <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
            Compromissos
          </Txt>
          <Field
            label="Título"
            value={appointment}
            onChangeText={(v) => {
              setAppointment(v);
              setErrors((e) => ({ ...e, title: undefined }));
            }}
            error={errors.title}
            maxLength={120}
            containerStyle={{ marginTop: 12 }}
          />
          <CareDateTimeField
            label="Início"
            value={appointmentAt}
            onChange={(d) => {
              setAppointmentAt(d);
              setErrors((e) => ({ ...e, appointmentAt: undefined }));
            }}
            error={errors.appointmentAt}
          />
          <PrimaryButton
            label={saving === 'appointment' ? 'Salvando…' : 'Salvar compromisso'}
            disabled={saving !== null}
            onPress={scheduleAppointment}
            style={{ marginTop: 14 }}
          />
          <ActionMessage message={appointmentMsg} onClose={() => setAppointmentMsg(null)} />
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
                    <Txt s={12} c={T.t3} style={{ marginTop: 2 }}>
                      {formatInDeviceTimeZone(item.starts_at)}
                      {item.ends_at ? ` → ${formatInDeviceTimeZone(item.ends_at)}` : ''}
                    </Txt>
                    {intervalError ? (
                      <Txt s={12} c={DANGER} style={{ marginTop: 3 }}>
                        {intervalError}
                      </Txt>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 12 }}>
            {name} vê os compromissos e check-ins em “Do meu cuidador”.
          </Txt>
        </Card>
      </Section>
    </>
  );
}
