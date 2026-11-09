import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, Chip, LinkButton, PrimaryButton, ScreenTitle, Toggle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { buildWorstCaseRoutines } from '../dev/worstCaseData';
import {
  createRoutineItem,
  deleteRoutineItem,
  listRoutineItems,
  updateRoutineItem,
  type RoutineItem,
} from '../routine/routineClient';
import { cancelRoutineReminder, resyncRoutineReminders, scheduleRoutineReminder } from '../notifications/notifications';
import { useApp, useTheme } from '../state/AppContext';
import { saveCapsule } from '../state/preferencesStore';
import { hapticSuccess, hapticTap } from '../theme/haptics';
import { updateRoutineWidget } from '../widgets/widgetBridge';

const ROUTINE_PRESETS: { hour: number; minute: number; name: string }[] = [
  { hour: 8, minute: 0, name: 'Beber água ao acordar' },
  { hour: 13, minute: 0, name: 'Pausa longe da tela' },
  { hour: 22, minute: 0, name: 'Desacelerar para dormir' },
];

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
  const [listError, setListError] = useState<string | null>(null);

  // Sem rede, "nenhum item ainda" seria mentira: mostra carregando e erro.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const loadItems = useCallback(() => {
    if (!state.userId) return;
    setLoadState('loading');
    listRoutineItems(state.userId)
      .then((list) => {
        setItems(list);
        setLoadState('ready');
        resyncRoutineReminders(list).catch(() => undefined);
      })
      .catch(() => setLoadState('error'));
  }, [state.userId]);
  useEffect(() => {
    loadItems();
  }, [loadItems]);

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
    if (!state.userId) {
      setFormError('Entre na sua conta para salvar a rotina.');
      return;
    }
    if (!name) {
      setFormError('Dê um nome para o item da rotina.');
      return;
    }
    if (saving) return; // toque duplo não cria dois itens
    setSaving(true);
    setFormError(null);
    setNameInput('');
    createRoutineItem(state.userId, time, name, true)
      .then((item) => {
        setItems((prev) => [...prev, item].sort((a, b) => a.time.localeCompare(b.time)));
        scheduleRoutineReminder(item.id, item.time, item.name).catch(() => undefined);
      })
      .catch((error) => {
        setNameInput(name);
        setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.');
      })
      .finally(() => setSaving(false));
  };

  const toggleNotify = (item: RoutineItem) => {
    const notify = !item.notify;
    setListError(null);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, notify } : i)));
    updateRoutineItem(item.id, { notify }).catch(() => {
      // Volta o interruptor se o servidor não aceitou.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, notify: !notify } : i)));
      setListError('Não foi possível mudar o lembrete agora.');
    });
    if (notify) scheduleRoutineReminder(item.id, item.time, item.name).catch(() => undefined);
    else cancelRoutineReminder(item.id).catch(() => undefined);
  };

  const removeItem = (item: RoutineItem) =>
    Alert.alert(`Remover "${item.name}"?`, 'O lembrete diário também é cancelado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          cancelRoutineReminder(item.id).catch(() => undefined);
          deleteRoutineItem(item.id).catch(() => {
            setListError('Não foi possível remover agora; o item voltou para a lista.');
            loadItems();
          });
        },
      },
    ]);

  const extremeItems = useMemo(
    () => (state.stressMode === 'extreme' ? buildWorstCaseRoutines() : []),
    [state.stressMode]
  );
  const displayItems =
    state.stressMode === 'empty' ? [] : state.stressMode === 'extreme' ? extremeItems : items;
  const isRoutineLoading = state.stressMode === 'off' && loadState === 'loading' && items.length === 0;
  const isRoutineError = state.stressMode === 'off' && loadState === 'error' && items.length === 0;

  const pickTime = () => {
    hapticTap();
    if (Platform.OS === 'web') {
      // No navegador o DateTimePicker nativo não abre modal; avança 30 minutos por toque.
      setTimeValue((prev) => {
        const next = new Date(prev);
        next.setMinutes(next.getMinutes() + 30);
        return next;
      });
      return;
    }
    setShowPicker(true);
  };

  const applyPreset = (hour: number, minute: number, name: string) => {
    hapticTap();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    setTimeValue(next);
    setNameInput(name);
    setFormError(null);
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="Rotina" title={'O seu dia,\nem blocos'} />

      <Section top={0}>
        <Card radius={24} padding={18} style={{ gap: 12 }}>
          {isRoutineLoading ? (
            <View
              accessible
              accessibilityLabel="Carregando sua rotina"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <ActivityIndicator color={T.pri} />
              <Txt s={12.5} c={T.t3}>
                Carregando sua rotina…
              </Txt>
            </View>
          ) : isRoutineError ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Txt s={12.5} lh={1.5} c={T.danger}>
                Não foi possível carregar sua rotina.
              </Txt>
              <LinkButton label="Tentar novamente" onPress={loadItems} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
            </View>
          ) : displayItems.length === 0 ? (
            <View style={{ gap: 10 }}>
              <Txt s={14} w={800} c={T.t1}>
                Seu dia está livre por enquanto
              </Txt>
              <Txt s={12.5} lh={1.5} c={T.t2}>
                Âncoras leves ajudam sem engessar a semana. Toque em uma sugestão para preencher o horário:
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                {ROUTINE_PRESETS.map((p) => {
                  const label = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} · ${p.name}`;
                  return (
                    <Chip
                      key={label}
                      label={label}
                      on={nameInput === p.name}
                      onPress={() => applyPreset(p.hour, p.minute, p.name)}
                    />
                  );
                })}
              </View>
            </View>
          ) : (
            displayItems.map((item, idx) => (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingTop: idx === 0 ? 0 : 10,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: T.bdL,
                }}
              >
                <Txt s={12.5} w={800} c={T.pri} style={{ width: 46, flexShrink: 0 }}>
                  {item.time}
                </Txt>
                <Txt s={13.5} lh={1.4} c={T.t1} style={{ flex: 1, minWidth: 0 }}>
                  {item.name}
                </Txt>
                <Toggle
                  label={`Lembrete de ${item.name}`}
                  on={item.notify}
                  onPress={() => {
                    if (state.stressMode === 'off') toggleNotify(item);
                  }}
                />
                {state.stressMode === 'off' ? (
                  <Touchable
                    onPress={() => removeItem(item)}
                    accessibilityLabel={`Remover ${item.name}`}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon d={ICONS.close} size={16} color={T.danger} />
                  </Touchable>
                ) : null}
              </View>
            ))
          )}
          {/* Falhas de lembrete/remoção aparecem aqui, junto da lista. */}
          {listError ? (
            <Txt s={12} lh={1.45} c={T.danger} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {listError}
            </Txt>
          ) : null}
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 12 }}>
            Adicionar bloco
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Touchable
              onPress={pickTime}
              accessibilityLabel={`Horário selecionado ${formatTime(timeValue)}. Toque para ajustar`}
              style={{
                width: 96,
                minHeight: 50,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: T.surfWarm,
                borderWidth: 1,
                borderColor: T.bd,
                flexShrink: 0,
              }}
            >
              <Txt s={15} w={800} c={T.t1}>
                {formatTime(timeValue)}
              </Txt>
            </Touchable>
            <Field
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Ex.: Pausa para respirar"
              accessibilityLabel="Nome do item da rotina"
              containerStyle={{ flex: 1, minWidth: 0 }}
            />
          </View>
          {showPicker && Platform.OS !== 'web' ? (
            <DateTimePicker value={timeValue} mode="time" is24Hour display="default" onChange={onTimeChange} />
          ) : null}
          {formError ? (
            <Txt s={12} c={T.danger} style={{ marginTop: 8 }} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {formError}
            </Txt>
          ) : null}
          <PrimaryButton
            label="+ Adicionar à rotina"
            onPress={addItem}
            loading={saving}
            style={{ marginTop: 12 }}
          />
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 10 }}>
            Cada item ativa um lembrete diário suave no horário escolhido.
          </Txt>
        </Card>
      </Section>

      {/* cápsula do tempo */}
      <Section>
        <View style={{ borderRadius: 24, padding: 18, backgroundColor: T.priL }}>
          <Txt s={14} w={800} c={T.pri}>
            Cápsula do tempo
          </Txt>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
            Escreva algo para você ler em 30 dias. Fica selado até lá.
          </Txt>
          <Field
            value={state.capsule}
            onChangeText={(capsule) => {
              actions.set({ capsule, capsuleSaved: false });
              if (state.userId) saveCapsule(state.userId, { text: capsule, saved: false }).catch(() => undefined);
            }}
            placeholder="Daqui a um mês eu espero…"
            containerStyle={{ marginTop: 12 }}
            style={{ backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd, borderRadius: 16 }}
          />
          <Touchable
            onPress={() => {
              if (!state.capsule.trim()) return;
              hapticSuccess();
              actions.set({ capsuleSaved: true });
              if (state.userId) saveCapsule(state.userId, { text: state.capsule, saved: true }).catch(() => undefined);
            }}
            accessibilityLabel={state.capsuleSaved ? 'Cápsula guardada para 30 dias' : 'Selar mensagem por 30 dias'}
            style={{
              marginTop: 10,
              minHeight: 50,
              paddingVertical: 13,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: state.capsuleSaved ? T.surf : T.pri,
              borderWidth: state.capsuleSaved ? 1 : 0,
              borderColor: T.bd,
            }}
          >
            <Txt s={13.5} w={800} c={state.capsuleSaved ? T.t2 : T.onPri}>
              {state.capsuleSaved ? 'Guardado para daqui a 30 dias' : 'Selar por 30 dias'}
            </Txt>
          </Touchable>
        </View>
      </Section>
    </ScreenScroll>
  );
}
