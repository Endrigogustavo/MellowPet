import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { createCareAppointment, createCareCheckin, listCareAppointments, listCareCheckins } from '../care/careClient';
import { useCareLinks } from '../care/useCareLinks';
import { deviceTimeZone, formatInDeviceTimeZone, localDateTimeInput, parseDeviceLocalDateTime, validateDateRange } from '../care/careDateTime';
import type { CareAppointment, CareCheckin } from '../care/careTypes';
import { CareConfigurationInactiveError } from '../care/careErrors';
import { CareConfigurationCard } from '../components/CareConfigurationCard';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { CarePersonPicker } from '../components/CarePersonPicker';
import { Field } from '../components/Field';
import { Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

export function AgendaScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care');
  const [checkins, setCheckins] = useState<CareCheckin[]>([]);
  const [appointments, setAppointments] = useState<CareAppointment[]>([]);
  const [prompt, setPrompt] = useState('Como você gostaria de estar agora?');
  const [checkinAt, setCheckinAt] = useState(localDateTimeInput());
  const [appointment, setAppointment] = useState('');
  const [appointmentAt, setAppointmentAt] = useState(localDateTimeInput(2));
  const [message, setMessage] = useState<string | null>(null);
  const [checkinDateError, setCheckinDateError] = useState<string | null>(null);
  const [appointmentDateError, setAppointmentDateError] = useState<string | null>(null);
  const [configurationInactive, setConfigurationInactive] = useState(false);
  const current = useMemo(() => links.find((link) => link.id === state.person) ?? links[0], [links, state.person]);

  const refresh = () => {
    if (!current?.cared_user_id || current.consent?.status !== 'active') return;
    setConfigurationInactive(false);
    Promise.all([listCareCheckins(current.cared_user_id), listCareAppointments(current.cared_user_id)]).then(([nextCheckins, nextAppointments]) => { setCheckins(nextCheckins); setAppointments(nextAppointments); }).catch((reason) => { setConfigurationInactive(reason instanceof CareConfigurationInactiveError); setMessage(reason instanceof Error ? reason.message : 'Não foi possível carregar a agenda.'); });
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current?.id, current?.cared_user_id, current?.consent?.status]);
  const scheduleCheckin = async () => {
    const parsed = parseDeviceLocalDateTime(checkinAt);
    if (!parsed.iso) { const error = parsed.error ?? 'Informe uma data válida.'; setCheckinDateError(error); setMessage(error); return; }
    if (!state.userId || !current?.cared_user_id || !prompt.trim()) { setMessage('Escreva uma pergunta antes de agendar o check-in.'); return; }
    setCheckinDateError(null);
    try { await createCareCheckin(current.cared_user_id, current.id, prompt.trim(), parsed.iso, state.userId); setMessage('Check-in agendado no horário local do aparelho.'); refresh(); } catch (reason) { setConfigurationInactive(reason instanceof CareConfigurationInactiveError); setMessage(reason instanceof Error ? reason.message : 'Não foi possível agendar o check-in.'); }
  };
  const scheduleAppointment = async () => {
    const parsed = parseDeviceLocalDateTime(appointmentAt);
    if (!parsed.iso) { const error = parsed.error ?? 'Informe uma data válida.'; setAppointmentDateError(error); setMessage(error); return; }
    if (!state.userId || !current?.cared_user_id || !appointment.trim()) { setMessage('Dê um título ao compromisso antes de salvá-lo.'); return; }
    setAppointmentDateError(null);
    try { await createCareAppointment(current.cared_user_id, current.id, appointment.trim(), parsed.iso, state.userId); setAppointment(''); setMessage('Compromisso salvo no horário local do aparelho.'); refresh(); } catch (reason) { setConfigurationInactive(reason instanceof CareConfigurationInactiveError); setMessage(reason instanceof Error ? reason.message : 'Não foi possível salvar o compromisso.'); }
  };

  return <ScreenScroll><ScreenTitle label="AGENDA" title={current?.cared_name ? `Ritmo de\n${current.cared_name}` : 'Ritmo e\ncheck-ins'} />
    <CarePersonPicker links={links} />
    {linksLoading && links.length === 0 ? <Section top={0}><Card radius={24} padding={20}><Txt s={13} c={T.t3}>Carregando conexões…</Txt></Card></Section> : linksError ? <Section top={0}><CareLinksErrorCard error={linksError} onRetry={refreshLinks} /></Section> : !current ? <Section top={0}><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1}>Conecte uma pessoa para organizar check-ins.</Txt></Card></Section> : current.consentConfigurationInactive || configurationInactive ? <Section top={0}><CareConfigurationCard feature="A agenda e os check-ins" /></Section> : current.consent?.status !== 'active' ? <Section top={0}><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1}>Agenda aguardando permissão</Txt><Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>A pessoa decide se check-ins e agenda podem ser compartilhados.</Txt></Card></Section> : <>
      {message ? <Section top={0}><View accessibilityLiveRegion="polite"><Card radius={18} padding={13} style={{ borderColor: message.includes('agendado') || message.includes('salvo') ? T.pri : DANGER }}><Txt s={12.5} c={message.includes('agendado') || message.includes('salvo') ? T.pri : DANGER}>{message}</Txt></Card></View></Section> : null}
      <Section top={message ? 10 : 0}><Card radius={24} padding={18}><Txt s={15} w={800} c={T.t1}>Novo check-in</Txt><Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>Convites de conversa; não são cobrança nem monitoramento automático.</Txt><Field label="Pergunta" value={prompt} onChangeText={setPrompt} style={{ marginTop: 12 }} /><Field label="Quando (AAAA-MM-DD HH:mm)" value={checkinAt} onChangeText={(value) => { setCheckinAt(value); setCheckinDateError(null); }} error={checkinDateError} hint={`Interpretado em ${deviceTimeZone()} (horário deste aparelho).`} accessibilityHint="Informe data e hora locais no formato ano, mês, dia, hora e minuto." /><Touchable onPress={scheduleCheckin} accessibilityRole="button" accessibilityLabel="Agendar check-in" style={{ marginTop: 10 }}><Txt s={12.5} w={800} c={T.pri}>Agendar check-in</Txt></Touchable></Card></Section>
      <Section><Card radius={24} padding={18}><Txt s={15} w={800} c={T.t1}>Check-ins previstos</Txt><View style={{ gap: 9, marginTop: 11 }}>{checkins.length === 0 ? <Txt s={12.5} c={T.t3}>Nenhum check-in agendado.</Txt> : checkins.filter((item) => item.status === 'scheduled').slice(0, 6).map((item) => <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}><Txt s={12.5} w={800} c={T.t1}>{item.prompt}</Txt><Txt s={11} c={T.t3} style={{ marginTop: 2 }}>{formatInDeviceTimeZone(item.scheduled_for)}</Txt></View>)}</View></Card></Section>
      <Section><Card radius={24} padding={18}><Txt s={15} w={800} c={T.t1}>Compromissos</Txt><Field label="Título" value={appointment} onChangeText={setAppointment} style={{ marginTop: 12 }} /><Field label="Início (AAAA-MM-DD HH:mm)" value={appointmentAt} onChangeText={(value) => { setAppointmentAt(value); setAppointmentDateError(null); }} error={appointmentDateError} hint={`Interpretado em ${deviceTimeZone()} (horário deste aparelho).`} accessibilityHint="Informe início em horário local no formato ano, mês, dia, hora e minuto." /><Touchable onPress={scheduleAppointment} accessibilityRole="button" accessibilityLabel="Salvar compromisso" style={{ marginTop: 10 }}><Txt s={12.5} w={800} c={T.pri}>Salvar compromisso</Txt></Touchable><View style={{ gap: 9, marginTop: 14 }}>{appointments.length === 0 ? <Txt s={12.5} c={T.t3}>Nenhum compromisso próximo.</Txt> : appointments.slice(0, 6).map((item) => { const intervalError = validateDateRange(item.starts_at, item.ends_at); return <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}><Txt s={12.5} w={800} c={T.t1}>{item.title}</Txt><Txt s={11} c={T.t3} style={{ marginTop: 2 }}>{formatInDeviceTimeZone(item.starts_at)}{item.ends_at ? ` → ${formatInDeviceTimeZone(item.ends_at)}` : ''}</Txt>{intervalError ? <Txt s={11} c={DANGER} accessibilityLiveRegion="polite" style={{ marginTop: 3 }}>{intervalError}</Txt> : null}</View>; })}</View></Card></Section>
    </>}</ScreenScroll>;
}
