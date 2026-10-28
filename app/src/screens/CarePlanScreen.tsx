import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  createCareTeamMember,
  createPrivateNote,
  fetchCarePlan,
  listCareTeam,
  listPrivateNotes,
  saveCarePlan,
  type CaregiverLink,
} from '../care/careClient';
import { useCareResource } from '../care/useCareResource';
import { CareGate, ErrorCard, LoadingCard, useCurrentCareLink } from '../components/CareStates';
import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

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
        {(current) => <PlanForm key={current.id} link={current} />}
      </CareGate>
    </ScreenScroll>
  );
}

function PlanForm({ link }: { link: CaregiverLink }) {
  const { state } = useApp();
  const { T } = useTheme();
  const cared = link.cared_user_id;
  const loaded = useCareResource(cared && state.userId ? cared : null, async () => {
    const [plan, team, notes] = await Promise.all([
      fetchCarePlan(cared!),
      listCareTeam(cared!),
      listPrivateNotes(state.userId!, cared!),
    ]);
    return { plan, team, notes };
  });
  const [title, setTitle] = useState('Plano de cuidado');
  const [signs, setSigns] = useState('');
  const [steps, setSteps] = useState('');
  const [note, setNote] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState<'plan' | 'note' | 'member' | null>(null);

  // Preenche o formulário uma vez por carregamento bem-sucedido.
  const plan = loaded.data?.plan ?? null;
  useEffect(() => {
    if (!loaded.data) return;
    setTitle(plan?.title ?? 'Plano de cuidado');
    setSigns(plan?.warning_signs.join('\n') ?? '');
    setSteps(plan?.steps.join('\n') ?? '');
  }, [loaded.data, plan]);

  if (loaded.error) {
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
  const { team, notes } = loaded.data;
  const userId = state.userId;

  const run = async (kind: 'plan' | 'note' | 'member', job: () => Promise<string>) => {
    if (saving) return;
    setSaving(kind);
    try {
      setMessage({ text: await job(), tone: 'ok' });
      await loaded.refresh();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Não foi possível salvar.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const save = () => {
    const warningSigns = listFromLines(signs);
    const nextSteps = listFromLines(steps);
    if (!warningSigns.items.length && !nextSteps.items.length) {
      setMessage({ text: 'Inclua ao menos um sinal de atenção ou um próximo passo.', tone: 'error' });
      return;
    }
    run('plan', async () => {
      await saveCarePlan(cared, userId, {
        title: title.trim() || 'Plano de cuidado',
        warning_signs: warningSigns.items,
        steps: nextSteps.items,
        // O plano foi lido com sucesso antes (senão nem chegaríamos aqui):
        // os contatos de emergência existentes são preservados.
        emergency_contacts: plan?.emergency_contacts ?? [],
      });
      const ignored = warningSigns.ignoredDuplicates + nextSteps.ignoredDuplicates;
      return ignored
        ? `Plano salvo. ${ignored} linha${ignored === 1 ? '' : 's'} repetida${ignored === 1 ? '' : 's'} foi removida.`
        : 'Plano salvo. Combine as mudanças com a pessoa acompanhada.';
    });
  };

  const addNote = () => {
    const body = note.trim();
    if (!body) {
      setMessage({ text: 'Escreva a nota primeiro.', tone: 'error' });
      return;
    }
    setNote('');
    run('note', async () => {
      await createPrivateNote(userId, cared, body);
      return 'Nota privada guardada.';
    });
  };

  const addMember = () => {
    const name = memberName.trim();
    const role = memberRole.trim();
    if (!name || !role) {
      setMessage({ text: 'Preencha o nome e a função.', tone: 'error' });
      return;
    }
    if (team.some((m) => normalizeText(m.name) === normalizeText(name) && normalizeText(m.role) === normalizeText(role))) {
      setMessage({ text: 'Essa pessoa já está na equipe com essa mesma função.', tone: 'error' });
      return;
    }
    setMemberName('');
    setMemberRole('');
    run('member', async () => {
      await createCareTeamMember(cared, userId, { name, role, contact: null, can_receive_alerts: false });
      return 'Pessoa adicionada à equipe de cuidado.';
    });
  };

  return (
    <>
      {message ? (
        <Section top={0}>
          <Card radius={18} padding={14} style={{ borderColor: message.tone === 'ok' ? OK : DANGER }}>
            <Txt s={12.5} c={message.tone === 'ok' ? OK : DANGER} accessibilityLiveRegion="polite">
              {message.text}
            </Txt>
          </Card>
        </Section>
      ) : null}

      <Section top={message ? 10 : 0}>
        <Card radius={24} padding={18}>
          <Txt s={11.5} w={800} c={T.pri}>
            CONTEÚDO COMPARTILHADO
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            O plano fica disponível para a pessoa acompanhada. Evite incluir informações que não tenham sido combinadas.
          </Txt>
          <Field label="Nome do plano" value={title} onChangeText={(t) => setTitle(t.slice(0, 80))} maxLength={80} />
          <Field
            label="Sinais que pedem uma conversa (um por linha)"
            value={signs}
            onChangeText={setSigns}
            multiline
            maxLength={1500}
            style={{ minHeight: 86, textAlignVertical: 'top' }}
          />
          <Field
            label="O que ajuda e qual o próximo passo (um por linha)"
            value={steps}
            onChangeText={setSteps}
            multiline
            maxLength={1500}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
          <PrimaryButton
            label={saving === 'plan' ? 'Salvando…' : 'Salvar plano combinado'}
            disabled={saving !== null}
            onPress={save}
            style={{ marginTop: 14 }}
          />
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
          <Field label="Nome" value={memberName} onChangeText={setMemberName} maxLength={60} style={{ marginTop: 10 }} />
          <Field label="Função ou vínculo" value={memberRole} onChangeText={setMemberRole} maxLength={60} />
          <Touchable onPress={addMember} disabled={saving !== null} accessibilityRole="button" style={{ marginTop: 10 }}>
            <Txt s={12.5} w={800} c={T.pri}>
              {saving === 'member' ? 'Adicionando…' : 'Adicionar à equipe'}
            </Txt>
          </Touchable>
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={11.5} w={800} c={T.pri}>
            PRIVADO DO CUIDADOR
          </Txt>
          <Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 4 }}>
            Notas privadas
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            Estas notas são só suas: a pessoa acompanhada não as vê.
          </Txt>
          <Field
            label="Nova nota"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            style={{ minHeight: 78, textAlignVertical: 'top', marginTop: 12 }}
          />
          <Touchable onPress={addNote} disabled={saving !== null} accessibilityRole="button" style={{ marginTop: 10 }}>
            <Txt s={12.5} w={800} c={T.pri}>
              {saving === 'note' ? 'Guardando…' : 'Guardar nota privada'}
            </Txt>
          </Touchable>
          <View style={{ gap: 9, marginTop: 13 }}>
            {notes.slice(0, 4).map((item) => (
              <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: T.bdL, paddingTop: 10 }}>
                <Txt s={12.5} c={T.t2}>
                  {item.body}
                </Txt>
                <Txt s={10.5} c={T.t3} style={{ marginTop: 3 }}>
                  {new Date(item.created_at).toLocaleString('pt-BR')}
                </Txt>
              </View>
            ))}
          </View>
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
