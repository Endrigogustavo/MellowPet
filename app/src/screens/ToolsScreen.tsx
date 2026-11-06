import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, Chip, Enter, PrimaryButton, ScreenTitle, Touchable, Txt, useColumnWidth } from '../components/ui';
import { GROUND, ICONS, JOURNAL_TAGS, TOOL_LIST } from '../data/content';
import { FACE_ICON } from '../data/emotions';
import { buildWorstCaseJournal } from '../dev/worstCaseData';
import { createJournalEntry, listJournalEntries } from '../journal/journalClient';
import { useApp, useTheme } from '../state/AppContext';
import { hapticSuccess, hapticTap } from '../theme/haptics';
import { hexA } from '../theme/palette';

/** Lista numerada usada pelo plano de 3 passos. */
export function NumberedList({ items, bg }: { items: string[]; bg?: string }) {
  const { T } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {items.map((text, i) => (
        <View key={text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: bg ?? T.priL,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Txt s={11.5} w={800} c={T.pri}>
              {i + 1}
            </Txt>
          </View>
          <Txt s={13.5} lh={1.55} c={T.t2} style={{ flex: 1, minWidth: 0 }}>
            {text}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function ToolsScreen() {
  const { state, actions } = useApp();
  const { T, full, emo, emoInk, emoLight } = useTheme();

  const toolWidth = useColumnWidth(2, 10);
  const tools = full ? TOOL_LIST : TOOL_LIST.slice(0, 6);
  const confPct = Math.round(emo.conf * 100);
  const canSave = state.jInput.trim().length > 0;
  const [showJournalList, setShowJournalList] = useState(false);
  const extremeJournal = useMemo(
    () => (state.stressMode === 'extreme' ? buildWorstCaseJournal() : []),
    [state.stressMode]
  );
  const displayJournal =
    state.stressMode === 'empty' ? [] : state.stressMode === 'extreme' ? extremeJournal : state.journal;

  useEffect(() => {
    if (!state.userId) return;
    listJournalEntries(state.userId)
      .then((entries) => actions.set({ journal: entries }))
      .catch(() => undefined);
    // Só na entrada da tela: o diário é atualizado localmente depois disso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  const saveJournalEntry = () => {
    const text = state.jInput.trim();
    if (!text) return;
    hapticSuccess();
    const tag = state.jTag;
    actions.set({ jInput: '' });
    if (state.userId) {
      createJournalEntry(state.userId, text, tag)
        .then((entry) => actions.set((s) => ({ journal: [entry, ...s.journal] })))
        .catch(() => {
          actions.set((s) => ({ journal: [{ text, tag, when: 'agora' }, ...s.journal] }));
        });
    } else {
      actions.set((s) => ({ journal: [{ text, tag, when: 'agora' }, ...s.journal] }));
    }
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="Cuidado" title={'O próximo passo,\nmais simples'} />

      {/* leitura atual */}
      <Section top={0}>
        <View style={{ padding: 16, borderRadius: 22, backgroundColor: emoLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon
                d={FACE_ICON[state.observedExpression]}
                size={20}
                color={emoInk}
                sw={1.9}
                circle
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt s={15} w={800} c={T.t1}>
                {emo.label}
              </Txt>
              <Txt s={12} c={T.t2} cap>
                {emo.variant} · {confPct}%
              </Txt>
            </View>
          </View>
          <Txt s={13.5} lh={1.6} c={T.t2} style={{ marginTop: 11 }}>
            {emo.tip}
          </Txt>
        </View>
      </Section>

      {full ? (
        <Section>
          <Card>
            <Txt s={14} w={800} c={T.t1}>
              Plano de 3 passos
            </Txt>
            <View style={{ marginTop: 12 }}>
              <NumberedList items={emo.plan} />
            </View>
          </Card>
        </Section>
      ) : null}

      {/* grade de exercícios */}
      <Section style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tools.map((t) => (
          <Touchable
            key={t.title}
            onPress={() => {
              hapticTap();
              actions.openTool(t.act, t.title, t.sub);
            }}
            style={{
              width: toolWidth,
              minHeight: 126,
              borderRadius: 22,
              padding: 15,
              gap: 10,
              backgroundColor: t.accent ? T.priL : T.surf,
              borderWidth: 1,
              borderColor: t.accent ? 'transparent' : T.bd,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: t.accent ? T.surf : T.surfWarm,
              }}
            >
              <Icon d={t.icon} size={19} color={t.accent ? T.pri : T.t1} />
            </View>
            <View>
              <Txt s={13.5} w={800} c={T.t1} lh={1.25}>
                {t.title}
              </Txt>
              <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
                {t.sub}
              </Txt>
            </View>
          </Touchable>
        ))}
      </Section>

      {/* diário */}
      <Section top={20}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Txt s={14} w={800} c={T.t1}>
            Diário rápido
          </Txt>
          {displayJournal.length > 0 ? (
            <Touchable
              onPress={() => {
                hapticTap();
                setShowJournalList((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showJournalList }}
              accessibilityLabel={`${showJournalList ? 'Ocultar' : 'Ver'} ${displayJournal.length} ${
                displayJournal.length === 1 ? 'registro' : 'registros'
              }`}
              style={{
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: showJournalList ? T.pri : T.priL,
                  borderWidth: 1,
                  borderColor: showJournalList ? T.pri : hexA(T.pri, 0.28),
                }}
              >
                <Txt s={12} w={800} c={showJournalList ? T.onPri : T.pri}>
                  {displayJournal.length} {displayJournal.length === 1 ? 'registro' : 'registros'}
                </Txt>
                <Icon
                  d={ICONS.chevron}
                  size={13}
                  color={showJournalList ? T.onPri : T.pri}
                  sw={2.3}
                  rotate={showJournalList ? -90 : 90}
                />
              </View>
            </Touchable>
          ) : (
            <Txt s={12} c={T.t3}>
              0 registros
            </Txt>
          )}
        </View>
        <Card>
          <Field
            variant="filled"
            value={state.jInput}
            onChangeText={(jInput) => actions.set({ jInput })}
            placeholder="Uma frase sobre agora…"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {JOURNAL_TAGS.map((t) => (
              <Chip
                key={t}
                label={t}
                on={t === state.jTag}
                onPress={() => actions.set({ jTag: t })}
              />
            ))}
          </View>
          <PrimaryButton
            label="Guardar nota"
            disabled={!canSave}
            onPress={saveJournalEntry}
            style={{ marginTop: 12 }}
          />

          {showJournalList && displayJournal.length > 0 ? (
            <Enter seq={1}>
              <View style={{ gap: 10, marginTop: 14 }}>
                {displayJournal.map((j, i) => (
                  <View
                    key={`${j.when}-${i}`}
                    style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: T.bdL }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <Txt s={11.5} w={800} c={T.pri}>
                        {j.tag}
                      </Txt>
                      <Txt s={11} c={T.t3}>
                        {j.when}
                      </Txt>
                    </View>
                    <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 5 }}>
                      {j.text}
                    </Txt>
                  </View>
                ))}
              </View>
            </Enter>
          ) : null}
        </Card>
      </Section>

      {/* aterramento 5-4-3-2-1 */}
      <Section top={20}>
        <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 10 }}>
          Aterramento 5-4-3-2-1
        </Txt>
        {state.ground >= 0 ? (
          <View style={{ backgroundColor: emoLight, borderRadius: 22, padding: 18 }}>
            <Txt s={12} w={800} c={T.pri}>
              Passo {state.ground + 1} de 5
            </Txt>
            <Txt s={16} w={700} lh={1.5} c={T.t1} style={{ marginTop: 8 }}>
              {GROUND[state.ground]}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Touchable
                onPress={() => actions.set({ ground: -1 })}
                style={{
                  minHeight: 46,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt s={13} w={700} c={T.t2}>
                  Parar
                </Txt>
              </Touchable>
              <Touchable
                onPress={() => {
                  hapticTap();
                  actions.set((s) => ({ ground: s.ground >= 4 ? -1 : s.ground + 1 }));
                }}
                style={{
                  flex: 1,
                  minHeight: 46,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: T.pri,
                }}
              >
                <Txt s={13.5} w={800} c={T.onPri}>
                  {state.ground >= 4 ? 'Terminei' : 'Próximo'}
                </Txt>
              </Touchable>
            </View>
          </View>
        ) : (
          <Touchable
            onPress={() => {
              hapticTap();
              actions.set({ ground: 0 });
            }}
            style={{
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              borderRadius: 22,
              minHeight: 68,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon d={ICONS.ground} size={20} color={T.pri} circle />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt s={14} w={800} c={T.t1}>
                Voltar ao presente
              </Txt>
              <Txt s={12} c={T.t3} style={{ marginTop: 3 }}>
                Cinco passos guiados, um por vez
              </Txt>
            </View>
            <Txt s={12.5} w={800} c={T.pri}>
              Começar
            </Txt>
          </Touchable>
        )}
      </Section>

      {/* atalhos */}
      <Section top={20}>
        <Touchable
          onPress={() => actions.go('guide')}
          style={{
            minHeight: 68,
            padding: 16,
            borderRadius: 22,
            backgroundColor: T.surf,
            borderWidth: 1,
            borderColor: T.bd,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Icon d={ICONS.book} size={20} color={T.pri} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt s={14} w={800} c={T.t1}>
              Guia e integrações
            </Txt>
            <Txt s={12} c={T.t2} style={{ marginTop: 2 }}>
              Tour interativo, Spotify, luzes e mais 10
            </Txt>
          </View>
          <Icon d={ICONS.chevron} size={16} color={T.pri} sw={2} />
        </Touchable>
      </Section>

      <Section top={10}>
        <Touchable
          onPress={() => actions.go('plans')}
          style={{
            minHeight: 68,
            padding: 16,
            borderRadius: 22,
            backgroundColor: T.priL,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Icon d={ICONS.star} size={20} color={T.pri} sw={1.9} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt s={14} w={800} c={T.t1}>
              Desbloquear tudo
            </Txt>
            <Txt s={12} c={T.t2} style={{ marginTop: 2 }}>
              12 bichinhos, diário e histórico completo
            </Txt>
          </View>
          <Icon d={ICONS.chevron} size={16} color={T.pri} sw={2} />
        </Touchable>
      </Section>

      {/* pedido de ajuda */}
      <Section top={16}>
        <Touchable
          onPress={actions.sos}
          style={{
            minHeight: 68,
            padding: 15,
            paddingHorizontal: 16,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: hexA(T.danger, 0.32),
            backgroundColor: T.surf,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: hexA(T.danger, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon d={ICONS.alert} size={18} color={T.danger} sw={1.9} circle />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt s={13.5} w={800} c={T.t1}>
              Preciso de ajuda agora
            </Txt>
            <Txt s={12} c={T.t3} style={{ marginTop: 2 }}>
              CVV 188 · avisar a rede · falar com o Mellow
            </Txt>
          </View>
          <Icon d={ICONS.chevron} size={16} color={T.danger} sw={2} />
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
