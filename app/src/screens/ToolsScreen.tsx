import React, { useEffect } from 'react';
import { View } from 'react-native';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Chip, ScreenTitle, Touchable, Txt, useColumnWidth } from '../components/ui';
import {
  BADGES,
  GOALS,
  GROUND,
  ICONS,
  JOURNAL_TAGS,
  TOOL_LIST,
} from '../data/content';
import { FACE_ICON } from '../data/emotions';
import { createJournalEntry, listJournalEntries } from '../journal/journalClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

/** Lista numerada usada pelo plano de 3 passos. */
export function NumberedList({ items, bg }: { items: string[]; bg?: string }) {
  const { T } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {items.map((text, i) => (
        <View key={text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: bg ?? T.priL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt s={11} w={800} c={T.pri}>
              {i + 1}
            </Txt>
          </View>
          <Txt s={13.5} lh={1.55} c={T.t2} style={{ flex: 1 }}>
            {text}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function ToolsScreen() {
  const { state, actions } = useApp();
  const { T, full, emo, emoColor, emoLight } = useTheme();

  const toolWidth = useColumnWidth(2, 10);
  const badgeWidth = useColumnWidth(3, 9);
  const tools = full ? TOOL_LIST : TOOL_LIST.slice(0, 6);
  const confPct = Math.round(emo.conf * 100);
  const canSave = state.jInput.trim().length > 0;

  useEffect(() => {
    if (!state.userId) return;
    listJournalEntries(state.userId)
      .then((entries) => actions.set({ journal: entries }))
      .catch(() => undefined);
    // Só na entrada da tela — o diário é atualizado localmente depois disso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  const saveJournalEntry = () => {
    const text = state.jInput.trim();
    if (!text) return;
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
      <ScreenTitle label="FERRAMENTAS" title={'O próximo passo,\nmais simples'} />

      {/* leitura atual */}
      <Section top={0}>
        <View style={{ padding: 16, borderRadius: 22, backgroundColor: emoLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                d={FACE_ICON[state.observedExpression]}
                size={20}
                color={emoColor}
                sw={1.9}
                circle
              />
            </View>
            <View style={{ flex: 1 }}>
              <Txt s={15} w={800} c={T.t1}>
                {emo.label}
              </Txt>
              <Txt s={12} c={T.t3} cap>
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
            <Txt s={13.5} w={800} c={T.t1}>
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
            onPress={() => actions.openTool(t.act, t.title, t.sub)}
            style={{
              width: toolWidth,
              minHeight: 124,
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
                width: 38,
                height: 38,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: t.accent ? T.surf : T.bg,
              }}
            >
              <Icon d={t.icon} size={19} color={t.accent ? T.pri : T.t1} />
            </View>
            <View>
              <Txt s={13.5} w={800} c={T.t1} lh={1.25}>
                {t.title}
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
                {t.sub}
              </Txt>
            </View>
          </Touchable>
        ))}
      </Section>

      {/* diário */}
      <Section top={14}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Txt s={13.5} w={800} c={T.t1}>
            Diário rápido
          </Txt>
          <Txt s={11.5} c={T.t3}>
            {state.journal.length} registros
          </Txt>
        </View>
        <Card>
          <Field
            variant="filled"
            value={state.jInput}
            onChangeText={(jInput) => actions.set({ jInput })}
            placeholder="Uma frase sobre agora…"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>
            {JOURNAL_TAGS.map((t) => (
              <Chip
                key={t}
                label={t}
                on={t === state.jTag}
                onPress={() => actions.set({ jTag: t })}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}
              />
            ))}
          </View>
          <Touchable
            disabled={!canSave}
            onPress={saveJournalEntry}
            style={{
              marginTop: 12,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: canSave ? T.pri : T.bd,
            }}
          >
            <Txt s={13.5} w={800} c={canSave ? '#fff' : T.t3}>
              Guardar
            </Txt>
          </Touchable>

          <View style={{ gap: 10, marginTop: 14 }}>
            {state.journal.map((j, i) => (
              <View
                key={`${j.when}-${i}`}
                style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: T.bdL }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Txt s={11} w={800} c={T.pri}>
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
        </Card>
      </Section>

      {/* aterramento 5-4-3-2-1 */}
      <Section top={14}>
        <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 10 }}>
          Aterramento 5-4-3-2-1
        </Txt>
        {state.ground >= 0 ? (
          <View style={{ backgroundColor: emoLight, borderRadius: 22, padding: 18 }}>
            <Txt s={11} w={800} c={T.t3} ls={1.4}>
              PASSO {state.ground + 1} de 5
            </Txt>
            <Txt s={16} w={700} lh={1.5} c={T.t1} style={{ marginTop: 9 }}>
              {GROUND[state.ground]}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
              <Touchable
                onPress={() => actions.set({ ground: -1 })}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 }}
              >
                <Txt s={13} w={700} c={T.t3}>
                  Parar
                </Txt>
              </Touchable>
              <Touchable
                onPress={() =>
                  actions.set((s) => ({ ground: s.ground >= 4 ? -1 : s.ground + 1 }))
                }
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: T.pri,
                }}
              >
                <Txt s={13.5} w={800} c="#fff">
                  {state.ground >= 4 ? 'Terminei' : 'Próximo'}
                </Txt>
              </Touchable>
            </View>
          </View>
        ) : (
          <Touchable
            onPress={() => actions.set({ ground: 0 })}
            style={{
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              borderRadius: 22,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon d={ICONS.ground} size={20} color={T.pri} circle />
            <View style={{ flex: 1 }}>
              <Txt s={13.5} w={800} c={T.t1}>
                Voltar ao presente
              </Txt>
              <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                Cinco passos guiados, um por vez
              </Txt>
            </View>
            <Txt s={12} w={800} c={T.pri}>
              Começar
            </Txt>
          </Touchable>
        )}
      </Section>

      {/* metas */}
      <Section top={14}>
        <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 10 }}>
          Metas da semana
        </Txt>
        <Card style={{ gap: 13 }}>
          {GOALS.map(([name, done, total]) => (
            <View key={name}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <Txt s={13} c={T.t1}>
                  {name}
                </Txt>
                <Txt s={12} w={800} c={T.t3}>
                  {done}/{total}
                </Txt>
              </View>
              <View style={{ marginTop: 7 }}>
                <Bar pct={Math.round((done / total) * 100)} color={T.pri} />
              </View>
            </View>
          ))}
        </Card>
      </Section>

      {/* conquistas */}
      <Section top={14}>
        <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 10 }}>
          Conquistas
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {BADGES.map(([name, , got, icon]) => (
            <View
              key={name}
              style={{
                width: badgeWidth,
                borderRadius: 18,
                paddingVertical: 13,
                paddingHorizontal: 8,
                alignItems: 'center',
                gap: 7,
                backgroundColor: got ? T.priL : T.surf,
                borderWidth: 1,
                borderStyle: got ? 'solid' : 'dashed',
                borderColor: got ? 'transparent' : T.bd,
                opacity: got ? 1 : 0.55,
              }}
            >
              <Icon d={icon} size={21} color={got ? T.pri : T.t3} />
              <Txt s={10.5} w={800} lh={1.3} c={T.t1} center>
                {name}
              </Txt>
            </View>
          ))}
        </View>
      </Section>

      {/* atalhos */}
      <Section top={14}>
        <Touchable
          onPress={() => actions.go('guide')}
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: T.surf,
            borderWidth: 1,
            borderColor: T.bd,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Icon d={ICONS.book} size={20} color={T.pri} />
          <View style={{ flex: 1 }}>
            <Txt s={13.5} w={800} c={T.t1}>
              Guia e integrações
            </Txt>
            <Txt s={11.5} c={T.t2} style={{ marginTop: 2 }}>
              Tour interativo, Spotify, luzes e mais 10
            </Txt>
          </View>
          <Txt s={12} w={800} c={T.pri}>
            Abrir
          </Txt>
        </Touchable>
      </Section>

      <Section>
        <Touchable
          onPress={() => actions.go('plans')}
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: T.priL,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Icon d={ICONS.star} size={20} color={T.pri} sw={1.9} />
          <View style={{ flex: 1 }}>
            <Txt s={13.5} w={800} c={T.t1}>
              Desbloquear tudo
            </Txt>
            <Txt s={11.5} c={T.t2} style={{ marginTop: 2 }}>
              12 bichinhos, diário e histórico completo
            </Txt>
          </View>
          <Txt s={12} w={800} c={T.pri}>
            Ver planos
          </Txt>
        </Touchable>
      </Section>

      {/* pedido de ajuda */}
      <Section top={12}>
        <Touchable
          onPress={actions.sos}
          style={{
            padding: 15,
            paddingHorizontal: 16,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,.32)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: 'rgba(239,68,68,.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.alert} size={17} color={DANGER} sw={1.9} circle />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={13} w={800} c={T.t1}>
              Preciso de ajuda agora
            </Txt>
            <Txt s={11.5} c={T.t3} style={{ marginTop: 2 }}>
              CVV 188 · avisar a rede · falar com o Mellow
            </Txt>
          </View>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
