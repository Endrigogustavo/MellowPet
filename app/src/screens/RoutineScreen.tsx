import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Toggle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import {
  createRoutineItem,
  deleteRoutineItem,
  listRoutineItems,
  updateRoutineItem,
  type RoutineItem,
} from '../routine/routineClient';
import { cancelRoutineReminder, resyncRoutineReminders, scheduleRoutineReminder } from '../notifications/notifications';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';
import { updateRoutineWidget } from '../widgets/widgetBridge';

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function RoutineScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();

  const [items, setItems] = useState<RoutineItem[]>([]);
  const [timeValue, setTimeValue] = useState(() => {
    const d = new Date();
    d.setHours(7, 30, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.userId) return;
    listRoutineItems(state.userId).then((list) => {
      setItems(list);
      resyncRoutineReminders(list).catch(() => undefined);
    });
  }, [state.userId]);

  // Widget "Rotina de hoje" — atualiza sempre que a lista muda por qualquer
  // motivo (carregar, adicionar, remover), não só com a tela aberta. Mostra
  // três itens em volta do agora: o que já passou fica "feito", o próximo
  // vira "agora" e o resto "a fazer", como no design.
  useEffect(() => {
    if (items.length === 0) {
      updateRoutineWidget([]);
      return;
    }
    const now = formatTime(new Date());
    const nextIndex = items.findIndex((item) => item.time >= now);
    const currentIndex = nextIndex === -1 ? items.length - 1 : nextIndex;
    // Uma janela de três centrada no item atual, sem estourar as pontas.
    const start = Math.max(0, Math.min(currentIndex - 1, items.length - 3));
    updateRoutineWidget(
      items.slice(start, start + 3).map((item) => ({
        time: item.time,
        name: item.name,
        state: item.time < now ? 'done' : items.indexOf(item) === currentIndex ? 'now' : 'todo',
      }))
    );
  }, [items]);

  // Precisa de identidade estável: o picker do Android reabre o diálogo
  // sempre que a prop `onChange` muda de referência (efeito interno da lib,
  // dependente de [onChange, valueTimestamp, mode]). Sem useCallback, uma
  // função nova a cada render — inclusive pelo tick de 1s do AppContext, que
  // re-renderiza toda tela que usa useApp() — reabria o diálogo, resetando a
  // seleção em andamento de volta pro valor antigo antes do usuário confirmar.
  const onTimeChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selected) setTimeValue(selected);
  }, []);

  const addItem = () => {
    const time = formatTime(timeValue);
    const name = nameInput.trim();
    if (!name || !state.userId) {
      setFormError('Dê um nome para o item da rotina.');
      return;
    }
    setFormError(null);
    createRoutineItem(state.userId, time, name, true)
      .then((item) => {
        setItems((prev) => [...prev, item].sort((a, b) => a.time.localeCompare(b.time)));
        setNameInput('');
        scheduleRoutineReminder(item.id, item.time, item.name).catch(() => undefined);
      })
      .catch((error) => setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.'));
  };

  const toggleNotify = (item: RoutineItem) => {
    const notify = !item.notify;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, notify } : i)));
    updateRoutineItem(item.id, { notify }).catch(() => undefined);
    if (notify) scheduleRoutineReminder(item.id, item.time, item.name).catch(() => undefined);
    else cancelRoutineReminder(item.id).catch(() => undefined);
  };

  const removeItem = (item: RoutineItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    deleteRoutineItem(item.id).catch(() => undefined);
    cancelRoutineReminder(item.id).catch(() => undefined);
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="ROTINA" title={'O seu dia,\nem blocos'} />

      <Section top={0}>
        <Card radius={24} padding={18} style={{ gap: 14 }}>
          {items.length === 0 ? (
            <Txt s={12.5} c={T.t3}>
              Nenhum item na rotina ainda. Adicione um abaixo.
            </Txt>
          ) : (
            items.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Txt s={12} w={800} c={T.t3} style={{ width: 44 }}>
                  {item.time}
                </Txt>
                <Txt s={13.5} c={T.t1} style={{ flex: 1 }}>
                  {item.name}
                </Txt>
                <Toggle on={item.notify} onPress={() => toggleNotify(item)} />
                <Touchable onPress={() => removeItem(item)} style={{ padding: 4 }}>
                  <Icon d={ICONS.close} size={16} color={DANGER} />
                </Touchable>
              </View>
            ))
          )}
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 12 }}>
            Adicionar item
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Touchable
              onPress={() => setShowPicker(true)}
              style={{
                width: 96,
                paddingVertical: 13,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: T.bg,
                borderWidth: 1,
                borderColor: T.bd,
              }}
            >
              <Txt s={14} w={700} c={T.t1}>
                {formatTime(timeValue)}
              </Txt>
            </Touchable>
            <Field
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Nome do item"
              containerStyle={{ flex: 1 }}
            />
          </View>
          {showPicker ? (
            <DateTimePicker value={timeValue} mode="time" is24Hour display="default" onChange={onTimeChange} />
          ) : null}
          {formError ? (
            <Txt s={12} c={DANGER} style={{ marginTop: 8 }}>
              {formError}
            </Txt>
          ) : null}
          <Touchable
            onPress={addItem}
            style={{
              marginTop: 12,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: T.pri,
            }}
          >
            <Txt s={13.5} w={800} c="#fff">
              + Adicionar
            </Txt>
          </Touchable>
          <Txt s={11.5} c={T.t3} style={{ marginTop: 10 }}>
            Cada item ativa um lembrete diário no horário escolhido.
          </Txt>
        </Card>
      </Section>

      {/* cápsula do tempo */}
      <Section>
        <View style={{ borderRadius: 24, padding: 18, backgroundColor: T.priL }}>
          <Txt s={13.5} w={800} c={T.pri}>
            Cápsula do tempo
          </Txt>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
            Escreva algo para você ler em 30 dias. Fica selado até lá.
          </Txt>
          <Field
            value={state.capsule}
            onChangeText={(capsule) => actions.set({ capsule })}
            placeholder="Daqui a um mês eu espero…"
            containerStyle={{ marginTop: 12 }}
            style={{ backgroundColor: T.surf, borderWidth: 0, borderRadius: 14, paddingVertical: 13 }}
          />
          <Touchable
            onPress={() => actions.set({ capsuleSaved: true })}
            style={{
              marginTop: 10,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: state.capsuleSaved ? T.bg : T.pri,
            }}
          >
            <Txt s={13.5} w={800} c={state.capsuleSaved ? T.t2 : '#fff'}>
              {state.capsuleSaved ? 'Guardado para daqui a 30 dias' : 'Selar por 30 dias'}
            </Txt>
          </Touchable>
        </View>
      </Section>
    </ScreenScroll>
  );
}
