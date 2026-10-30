import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { dayLabel, groupNotesByDay, recentDayOptions, wasEdited } from '../care/careNotes';
import { createCareNote, deleteCareNote, listCareNotes, updateCareNote } from '../care/careUxClient';
import type { CareNote } from '../care/careUxTypes';
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
  StaleNotice,
  UnavailableNotice,
  useCurrentCareLink,
} from '../components/CareStates';
import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';

type Message = { text: string; tone: 'ok' | 'error' };

export function CareNotesScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="ANOTAÇÕES" title={care.name ? `Notas sobre\n${care.name}` : 'Suas\nanotações'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para fazer anotações.">
        {(current, name) => <Notes key={current.id} link={current} name={name} />}
      </CareGate>
    </ScreenScroll>
  );
}

function DayChips({ value, onChange, days }: { value: string; onChange: (day: string) => void; days: string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {days.map((day) => (
        <CarePillButton key={day} label={dayLabel(day)} selected={day === value} onPress={() => onChange(day)} />
      ))}
    </ScrollView>
  );
}

function Notes({ link, name }: { link: CaregiverLink; name: string }) {
  const { state } = useApp();
  const { T } = useTheme();
  const userId = state.userId;
  const paused = isPaused(link);
  const notes = useCareResource(userId && !paused ? `${link.id}:${userId}` : null, () => listCareNotes(link, userId!));
  const days = recentDayOptions(14);
  const [day, setDay] = useState(days[0]);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string; day: string } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string; tone: 'ok' | 'error' } | null>(null);

  if (paused) {
    return (
      <Section top={0}>
        <EmptyCard
          title="Anotações indisponíveis na pausa"
          text={`Enquanto ${name} pausa o compartilhamento, suas anotações sobre ela ficam guardadas, mas não aparecem. Elas voltam quando ela retomar.`}
        />
      </Section>
    );
  }
  if (notes.error && !notes.data) {
    return (
      <Section top={0}>
        <ErrorCard title="Não foi possível carregar as anotações" error={notes.error} onRetry={notes.refresh} />
      </Section>
    );
  }
  if (!notes.data || !userId) {
    return (
      <Section top={0}>
        <LoadingCard text="Carregando anotações…" />
      </Section>
    );
  }
  const { dayColumn } = notes.data;
  const groups = groupNotesByDay(notes.data.notes);

  const save = async () => {
    const text = body.trim();
    if (!text || saving) {
      if (!text) setMessage({ text: 'Escreva a anotação primeiro.', tone: 'error' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createCareNote(link, userId, text, day, dayColumn);
      setBody(''); // só limpa depois de dar certo
      setMessage({ text: `Anotação guardada em ${dayLabel(day).toLowerCase()}.`, tone: 'ok' });
      await notes.refresh();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Não foi possível guardar.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || rowBusy) return;
    const text = editing.body.trim();
    if (!text) {
      setRowMessage({ id: editing.id, text: 'A anotação não pode ficar vazia.', tone: 'error' });
      return;
    }
    setRowBusy(editing.id);
    try {
      await updateCareNote(editing.id, text, dayColumn ? editing.day : null);
      const id = editing.id;
      notes.setData((prev) =>
        prev
          ? { ...prev, notes: prev.notes.map((n) => (n.id === id ? { ...n, body: text, note_day: dayColumn ? editing.day : n.note_day, updated_at: new Date().toISOString() } : n)) }
          : prev
      );
      setEditing(null);
      setRowMessage({ id, text: 'Edição salva.', tone: 'ok' });
    } catch (reason) {
      setRowMessage({ id: editing.id, text: reason instanceof Error ? reason.message : 'Não foi possível salvar.', tone: 'error' });
    } finally {
      setRowBusy(null);
    }
  };

  const remove = (note: CareNote) => {
    Alert.alert('Apagar esta anotação?', 'Ela some para sempre. Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          setRowBusy(note.id);
          deleteCareNote(note.id)
            .then(() => notes.setData((prev) => (prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== note.id) } : prev)))
            .catch((reason) => setRowMessage({ id: note.id, text: reason instanceof Error ? reason.message : 'Não foi possível apagar.', tone: 'error' }))
            .finally(() => setRowBusy(null));
        },
      },
    ]);
  };

  return (
    <>
      {notes.error ? (
        <Section top={0}>
          <StaleNotice at={notes.updatedAt} onRetry={notes.refresh} />
        </Section>
      ) : null}
      {!dayColumn ? (
        <Section top={notes.error ? 10 : 0}>
          <UnavailableNotice text="Escolher o dia ainda não foi ativado no servidor: novas anotações ficam no dia de hoje." />
        </Section>
      ) : null}
      <Section top={notes.error || !dayColumn ? 10 : 0}>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1}>
            Nova anotação
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            Só você vê. Anote o que observou ou combinou — fatos e conversas, não rótulos.
          </Txt>
          {dayColumn ? (
            <View style={{ marginTop: 12 }}>
              <Txt s={11.5} w={800} c={T.t2} style={{ marginBottom: 7 }}>
                Dia
              </Txt>
              <DayChips value={day} onChange={setDay} days={days} />
            </View>
          ) : null}
          <Field
            label="Anotação"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            containerStyle={{ marginTop: 12 }}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
            accessibilityLabel="Anotação"
          />
          <PrimaryButton label={saving ? 'Guardando…' : 'Guardar anotação'} disabled={saving} onPress={save} style={{ marginTop: 12 }} />
          <ActionMessage message={message} onClose={() => setMessage(null)} />
        </Card>
      </Section>

      {groups.length === 0 ? (
        <Section>
          <EmptyCard
            title="Nenhuma anotação ainda"
            text={`Anotar um momento, uma conversa ou algo que ajudou ${name} facilita lembrar depois — e conversar com mais calma.`}
          />
        </Section>
      ) : (
        groups.map((group) => (
          <Section key={group.day}>
            <Txt s={12} w={800} c={T.t2} ls={0.6} accessibilityRole="header" style={{ marginBottom: 7, marginLeft: 4 }}>
              {dayLabel(group.day).toUpperCase()}
            </Txt>
            <Card radius={22} padding={14} style={{ gap: 4 }}>
              {group.notes.map((note, index) => {
                const isEditing = editing?.id === note.id;
                const busy = rowBusy === note.id;
                return (
                  <View key={note.id} style={{ paddingTop: index ? 12 : 2, borderTopWidth: index ? 1 : 0, borderTopColor: T.bdL }}>
                    {isEditing && editing ? (
                      <>
                        {dayColumn ? <DayChips value={editing.day} onChange={(d) => setEditing({ ...editing, day: d })} days={days} /> : null}
                        <Field
                          value={editing.body}
                          onChangeText={(text) => setEditing({ ...editing, body: text })}
                          multiline
                          maxLength={1000}
                          containerStyle={{ marginTop: 8 }}
                          style={{ minHeight: 80, textAlignVertical: 'top' }}
                          accessibilityLabel="Editar anotação"
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <CarePillButton label={busy ? 'Salvando…' : 'Salvar'} onPress={saveEdit} disabled={busy} />
                          <CareLinkButton label="Cancelar" tone="muted" onPress={() => setEditing(null)} />
                        </View>
                      </>
                    ) : (
                      <>
                        <Txt s={13} lh={1.5} c={T.t1}>
                          {note.body}
                        </Txt>
                        <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                          {new Date(note.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {wasEdited(note) ? ' · editada' : ''}
                        </Txt>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <CareLinkButton
                            label="Editar"
                            disabled={busy}
                            onPress={() => {
                              setRowMessage(null);
                              setEditing({ id: note.id, body: note.body, day: note.note_day });
                            }}
                          />
                          <CareLinkButton label={busy ? 'Apagando…' : 'Apagar'} tone="danger" disabled={busy} onPress={() => remove(note)} />
                        </View>
                      </>
                    )}
                    {rowMessage?.id === note.id ? (
                      <ActionMessage message={rowMessage} onClose={() => setRowMessage(null)} />
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </Section>
        ))
      )}
    </>
  );
}
