import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { createCareTeamMember, createPrivateNote, fetchCarePlan, listCareTeam, listPrivateNotes, saveCarePlan } from '../care/careClient';
import { useCareLinks } from '../care/useCareLinks';
import type { CarePlan, CareTeamMember, CaregiverNote } from '../care/careTypes';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { CarePersonPicker } from '../components/CarePersonPicker';
import { Field } from '../components/Field';
import { Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const listFromLines = (value: string) => {
  const unique = new Set<string>();
  let ignoredDuplicates = 0;

  const items = value.split('\n').map((item) => item.trim()).filter((item) => {
    if (!item) return false;
    const key = normalizeText(item);
    if (unique.has(key)) {
      ignoredDuplicates += 1;
      return false;
    }
    unique.add(key);
    return true;
  });

  return { items, ignoredDuplicates };
};

export function CarePlanScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care');
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [team, setTeam] = useState<CareTeamMember[]>([]);
  const [notes, setNotes] = useState<CaregiverNote[]>([]);
  const [title, setTitle] = useState('Plano de cuidado');
  const [signs, setSigns] = useState('');
  const [steps, setSteps] = useState('');
  const [note, setNote] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const current = useMemo(() => links.find((link) => link.id === state.person) ?? links[0], [links, state.person]);
  const refresh = () => {
    if (!state.userId || !current?.cared_user_id) return;
    Promise.all([fetchCarePlan(current.cared_user_id), listCareTeam(current.cared_user_id), listPrivateNotes(state.userId, current.cared_user_id)]).then(([nextPlan, nextTeam, nextNotes]) => {
      setPlan(nextPlan); setTeam(nextTeam); setNotes(nextNotes);
      if (nextPlan) { setTitle(nextPlan.title); setSigns(nextPlan.warning_signs.join('\n')); setSteps(nextPlan.steps.join('\n')); }
    }).catch((reason) => { setMessage(reason instanceof Error ? reason.message : 'Não foi possível carregar o plano.'); });
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current?.id, current?.cared_user_id, state.userId]);
  const save = async () => {
    if (!state.userId || !current?.cared_user_id) return;
    const warningSigns = listFromLines(signs);
    const nextSteps = listFromLines(steps);
    if (!warningSigns.items.length && !nextSteps.items.length) {
      setMessage('Inclua ao menos um sinal de atenção ou um próximo passo antes de salvar o plano.');
      return;
    }
    try {
      await saveCarePlan(current.cared_user_id, state.userId, {
        title: title.trim() || 'Plano de cuidado',
        warning_signs: warningSigns.items,
        steps: nextSteps.items,
        emergency_contacts: plan?.emergency_contacts ?? [],
      });
      const ignored = warningSigns.ignoredDuplicates + nextSteps.ignoredDuplicates;
      setMessage(ignored ? `Plano salvo. ${ignored} linha${ignored === 1 ? '' : 's'} repetida${ignored === 1 ? '' : 's'} foi removida para evitar duplicidade.` : 'Plano salvo. Combine as mudanças com a pessoa acompanhada.');
      refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Não foi possível salvar o plano.'); }
  };
  const addNote = async () => {
    if (!state.userId || !current?.cared_user_id) return;
    if (!note.trim()) { setMessage('Escreva uma nota antes de salvá-la.'); return; }
    try { await createPrivateNote(state.userId, current.cared_user_id, note.trim()); setNote(''); setMessage('Nota privada salva.'); refresh(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Não foi possível salvar a nota.'); }
  };
  const addMember = async () => {
    if (!state.userId || !current?.cared_user_id) return;
    if (!memberName.trim() || !memberRole.trim()) { setMessage('Preencha o nome e a função antes de adicionar alguém à equipe.'); return; }
    const duplicate = team.some((member) => normalizeText(member.name) === normalizeText(memberName) && normalizeText(member.role) === normalizeText(memberRole));
    if (duplicate) { setMessage('Essa pessoa já está na equipe com essa mesma função. Revise a lista antes de adicionar novamente.'); return; }
    try { await createCareTeamMember(current.cared_user_id, state.userId, { name: memberName.trim(), role: memberRole.trim(), contact: null, can_receive_alerts: false }); setMemberName(''); setMemberRole(''); setMessage('Pessoa adicionada à equipe de cuidado.'); refresh(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Não foi possível adicionar à equipe.'); }
  };
  const messageIsPositive = Boolean(message && /salv|adicionad/i.test(message));

  return <ScreenScroll><ScreenTitle label="PLANO DE CUIDADO" title={current?.cared_name ? `Próximos passos\npara ${current.cared_name}` : 'Combinar\npróximos passos'} />
    <CarePersonPicker links={links} />
    {linksLoading && links.length === 0 ? <Section top={0}><Card radius={24} padding={20}><Txt s={13} c={T.t3}>Carregando conexões…</Txt></Card></Section> : linksError ? <Section top={0}><CareLinksErrorCard error={linksError} onRetry={refreshLinks} /></Section> : !current ? <Section top={0}><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1}>Conecte uma pessoa para criar um plano.</Txt></Card></Section> : <>
      {message ? <Section top={0}><Card radius={18} padding={14} style={{ borderColor: messageIsPositive ? T.pri : DANGER }}><Txt s={12.5} c={messageIsPositive ? T.pri : DANGER}>{message}</Txt></Card></Section> : null}
      <Section top={message ? 10 : 0}><Card radius={24} padding={18}><Txt s={11.5} w={800} c={T.pri}>CONTEÚDO COMPARTILHADO</Txt><Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>O plano fica disponível para a pessoa acompanhada e para participantes autorizados. Evite incluir informações que não tenham sido combinadas.</Txt><Field label="Nome do plano" value={title} onChangeText={setTitle} /><Field label="Sinais que pedem uma conversa (um por linha)" value={signs} onChangeText={setSigns} multiline style={{ minHeight: 86, textAlignVertical: 'top' }} /><Field label="O que ajuda e qual o próximo passo (um por linha)" value={steps} onChangeText={setSteps} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} /><Txt s={10.5} lh={1.4} c={T.t3} style={{ marginTop: 2 }}>Linhas em branco são ignoradas e itens repetidos serão salvos apenas uma vez.</Txt><PrimaryButton label="Salvar plano combinado" onPress={save} style={{ marginTop: 14 }} /></Card></Section>
      <Section><Card radius={24} padding={18}><Txt s={11.5} w={800} c={T.pri}>CONTEÚDO COMPARTILHADO</Txt><Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 4 }}>Equipe de cuidado</Txt><Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>A lista também fica visível à pessoa acompanhada. Adicione somente pessoas que a família combinou envolver.</Txt><View style={{ gap: 8, marginTop: 13 }}>{team.map((member) => <View key={member.id} style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: T.bdL }}><Txt s={13} w={800} c={T.t1}>{member.name}</Txt><Txt s={11.5} c={T.t3}>{member.role}</Txt></View>)}</View><Field label="Nome" value={memberName} onChangeText={setMemberName} style={{ marginTop: 10 }} /><Field label="Função ou vínculo" value={memberRole} onChangeText={setMemberRole} /><Touchable onPress={addMember} style={{ marginTop: 10 }}><Txt s={12.5} w={800} c={T.pri}>Adicionar à equipe</Txt></Touchable></Card></Section>
      <Section><Card radius={24} padding={18}><Txt s={11.5} w={800} c={T.pri}>PRIVADO DO CUIDADOR</Txt><Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 4 }}>Notas privadas</Txt><Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>Estas notas pertencem ao cuidador e não ficam visíveis para a pessoa acompanhada nem para os demais participantes.</Txt><Field label="Nova nota" value={note} onChangeText={setNote} multiline style={{ minHeight: 78, textAlignVertical: 'top', marginTop: 12 }} /><Touchable onPress={addNote} style={{ marginTop: 10 }}><Txt s={12.5} w={800} c={T.pri}>Salvar nota privada</Txt></Touchable><View style={{ gap: 9, marginTop: 13 }}>{notes.slice(0, 4).map((item) => <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}><Txt s={12.5} c={T.t2}>{item.body}</Txt><Txt s={10.5} c={T.t3} style={{ marginTop: 3 }}>{new Date(item.created_at).toLocaleString('pt-BR')}</Txt></View>)}</View></Card></Section>
      <Section><Txt s={11.5} lh={1.55} c={T.t3}>Em uma emergência imediata, use os serviços locais e o plano combinado. Este app não substitui atendimento de urgência.</Txt></Section>
    </>}</ScreenScroll>;
}
