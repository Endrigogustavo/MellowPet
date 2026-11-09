import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { createCareTeamMember, fetchCarePlan, listCareTeam, saveCarePlan, type CaregiverLink } from '../care/careClient';
import { isPaused } from '../care/presenceClient';
import { useCareResource } from '../care/useCareResource';
import {
  ActionMessage,
  CareGate,
  CareLinkButton,
  CarePillButton,
  EmptyCard,
  ErrorCard,
  LoadingCard,
  useCurrentCareLink,
} from '../components/CareStates';
import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const listFromLines = (value: string) => {
  const unique = new Set<string>();
  let ignoredDuplicates = 0;
  const items = value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => {
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

type Message = { text: string; tone: 'ok' | 'error' };

export function CarePlanScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="PLANO DE CUIDADO" title={care.name ? `Próximos passos\npara ${care.name}` : 'Combinar\npróximos passos'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para criar um plano.">
        {/* key: trocar de pessoa monta um formulário NOVO — nada do plano de
            uma pessoa fica nos campos da outra. */}
        {(current, name) => <PlanForm key={current.id} link={current} name={name} />}
      </CareGate>
    </ScreenScroll>
  );
}

function PlanForm({ link, name }: { link: CaregiverLink; name: string }) {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const cared = link.cared_user_id;
  const paused = isPaused(link);
  const loaded = useCareResource(cared && state.userId && !paused ? cared : null, async () => {
    const [plan, team] = await Promise.all([fetchCarePlan(cared!), listCareTeam(cared!)]);
    return { plan, team };
  });
  const [title, setTitle] = useState('Plano de cuidado');
  const [signs, setSigns] = useState('');
  const [steps, setSteps] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [planMsg, setPlanMsg] = useState<Message | null>(null);
  const [teamMsg, setTeamMsg] = useState<Message | null>(null);
  const [saving, setSaving] = useState<'plan' | 'member' | null>(null);

  // C4: preenche o formulário UMA vez. Atualizar a equipe depois não pode
  // sobrescrever o que está sendo editado no plano.
  const filled = useRef(false);
  const plan = loaded.data?.plan ?? null;
  useEffect(() => {
    if (!loaded.data || filled.current) return;
    filled.current = true;
    setTitle(plan?.title ?? 'Plano de cuidado');
    setSigns(plan?.warning_signs.join('\n') ?? '');
    setSteps(plan?.steps.join('\n') ?? '');
  }, [loaded.data, plan]);

  if (paused) {
    return (
      <Section top={0}>
        <EmptyCard title="Plano indisponível na pausa" text={`${name} pausou o compartilhamento. O plano volta a aparecer quando ela retomar.`} />
      </Section>
    );
  }
  if (loaded.error && !loaded.data) {
    return (
      <Section top={0}>
        <ErrorCard title="Não foi possível carregar o plano" error={loaded.error} onRetry={loaded.refresh} />
      </Section>
    );
  }
  if (!loaded.data || !cared || !state.userId) {
    return (
      <Section top={0}>
        <LoadingCard text="Carregando plano…" />
      </Section>
    );
  }
  const { team } = loaded.data;
  const userId = state.userId;

  const save = async () => {
    if (saving) return;
    const warningSigns = listFromLines(signs);
    const nextSteps = listFromLines(steps);
    if (!warningSigns.items.length && !nextSteps.items.length) {
      setPlanMsg({ text: 'Inclua ao menos um sinal de atenção ou um próximo passo.', tone: 'error' });
      return;
    }
    setSaving('plan');
    setPlanMsg(null);
    try {
      const patch = {
        title: title.trim() || 'Plano de cuidado',
        warning_signs: warningSigns.items,
        steps: nextSteps.items,
        // O plano foi lido com sucesso antes: os contatos existentes são preservados.
        emergency_contacts: plan?.emergency_contacts ?? [],
      };
      await saveCarePlan(cared, userId, patch);
      // Atualiza só o plano em memória — sem recarregar nem mexer nos campos.
      loaded.setData((prev) =>
        prev
          ? { ...prev, plan: { id: prev.plan?.id ?? '', cared_user_id: cared, ...patch, updated_at: new Date().toISOString() } }
          : prev
      );
      const ignored = warningSigns.ignoredDuplicates + nextSteps.ignoredDuplicates;
      setPlanMsg({
        text: ignored
          ? `Plano salvo. ${ignored} linha${ignored === 1 ? '' : 's'} repetida${ignored === 1 ? '' : 's'} foi removida.`
          : 'Plano salvo. Combine as mudanças com a pessoa acompanhada.',
        tone: 'ok',
      });
    } catch (reason) {
      setPlanMsg({ text: reason instanceof Error ? reason.message : 'Não foi possível salvar.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const addMember = async () => {
    if (saving) return;
    const memberN = memberName.trim();
    const role = memberRole.trim();
    if (!memberN || !role) {
      setTeamMsg({ text: 'Preencha o nome e a função.', tone: 'error' });
      return;
    }
    if (team.some((m) => normalizeText(m.name) === normalizeText(memberN) && normalizeText(m.role) === normalizeText(role))) {
      setTeamMsg({ text: 'Essa pessoa já está na equipe com essa mesma função.', tone: 'error' });
      return;
    }
    setSaving('member');
    setTeamMsg(null);
    try {
      await createCareTeamMember(cared, userId, { name: memberN, role, contact: null, can_receive_alerts: false });
      setMemberName(''); // só limpa depois de salvar
      setMemberRole('');
      setTeamMsg({ text: 'Pessoa adicionada à equipe de cuidado.', tone: 'ok' });
      // Recarrega só a equipe; o formulário do plano fica intacto.
      listCareTeam(cared)
        .then((next) => loaded.setData((prev) => (prev ? { ...prev, team: next } : prev)))
        .catch(() => undefined);
    } catch (reason) {
      setTeamMsg({ text: reason instanceof Error ? reason.message : 'Não foi possível adicionar.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <Section top={0}>
        <Card radius={24} padding={18}>
          <Txt s={11.5} w={800} c={T.pri}>
            CONTEÚDO COMPARTILHADO
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            {name} vê este plano em “Do meu cuidador”. Evite incluir informações que não tenham sido combinadas.
          </Txt>
          <Field label="Nome do plano" value={title} onChangeText={(t) => setTitle(t.slice(0, 80))} maxLength={80} containerStyle={{ marginTop: 12 }} />
          <Field
            label="Sinais que pedem uma conversa (um por linha)"
            value={signs}
            onChangeText={setSigns}
            multiline
            maxLength={1500}
            containerStyle={{ marginTop: 12 }}
            style={{ minHeight: 86, textAlignVertical: 'top' }}
          />
          <Field
            label="O que ajuda e qual o próximo passo (um por linha)"
            value={steps}
            onChangeText={setSteps}
            multiline
            maxLength={1500}
            containerStyle={{ marginTop: 12 }}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
          <PrimaryButton label={saving === 'plan' ? 'Salvando…' : 'Salvar plano combinado'} disabled={saving !== null} onPress={save} style={{ marginTop: 14 }} />
          <ActionMessage message={planMsg} onClose={() => setPlanMsg(null)} />
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={11.5} w={800} c={T.pri}>
            CONTEÚDO COMPARTILHADO
          </Txt>
          <Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 4 }}>
            Equipe de cuidado
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            Quem mais participa do cuidado (família, terapeuta). Fica visível à pessoa acompanhada e não dá acesso ao app.
          </Txt>
          <View style={{ gap: 8, marginTop: 13 }}>
            {team.length === 0 ? (
              <Txt s={12} c={T.t3}>
                Ninguém na equipe ainda.
              </Txt>
            ) : (
              team.map((member) => (
                <View key={member.id} style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: T.bdL }}>
                  <Txt s={13} w={800} c={T.t1}>
                    {member.name}
                  </Txt>
                  <Txt s={11.5} c={T.t3}>
                    {member.role}
                  </Txt>
                </View>
              ))
            )}
          </View>
          <Field label="Nome" value={memberName} onChangeText={setMemberName} maxLength={60} containerStyle={{ marginTop: 10 }} />
          <Field label="Função ou vínculo" value={memberRole} onChangeText={setMemberRole} maxLength={60} containerStyle={{ marginTop: 12 }} />
          <CarePillButton
            label={saving === 'member' ? 'Adicionando…' : 'Adicionar à equipe'}
            onPress={addMember}
            disabled={saving !== null}
            style={{ alignSelf: 'flex-start', marginTop: 12 }}
          />
          <ActionMessage message={teamMsg} onClose={() => setTeamMsg(null)} />
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={11.5} w={800} c={T.pri}>
            PRIVADO DO CUIDADOR
          </Txt>
          <Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 4 }}>
            Anotações
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            Suas notas sobre {name}, organizadas por dia. Só você vê.
          </Txt>
          <CareLinkButton label="Abrir anotações" onPress={() => actions.go('carenotes')} style={{ marginTop: 4 }} />
        </Card>
      </Section>

      <Section>
        <Txt s={11.5} lh={1.55} c={T.t3}>
          Em uma emergência imediata, ligue 192 (SAMU) ou 188 (CVV). Este app não substitui atendimento de urgência.
        </Txt>
      </Section>
    </>
  );
}
