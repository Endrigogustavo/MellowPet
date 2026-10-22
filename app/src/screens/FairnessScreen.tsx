import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Chip, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { EMOTIONS, type EmotionKey } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';
import {
  ATTRIBUTE_LABEL,
  EMPTY_PROFILE,
  GROUP_LABEL,
  analyzeGroups,
  type AuditAttribute,
  type AuditProfile,
  type GroupResult,
  type personalAgreement,
} from '../vision/fairness';
import {
  deleteAuditProfile,
  fetchFairnessReport,
  fetchPersonalAgreement,
  loadAuditProfile,
  saveAuditProfile,
} from '../vision/fairnessClient';

/**
 * "A leitura é justa com você?" — auditoria de viés.
 *
 * Mostra quanto a câmera concorda com o que a pessoa diz no check-in, para
 * ela e, de forma agregada (k ≥ 5), por grupo autodeclarado. Os atributos são
 * opcionais e apagáveis; sem eles a pessoa ainda vê o próprio acerto.
 */
type Personal = ReturnType<typeof personalAgreement>;

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);

const GLASSES: [AuditProfile['glasses'], string][] = [
  ['sim', 'Uso'],
  ['as_vezes', 'Às vezes'],
  ['nao', 'Não uso'],
];
const AGES: AuditProfile['ageBand'][] = ['<18', '18-24', '25-34', '35-49', '50+'];
const BEARD: [AuditProfile['facialHair'], string][] = [
  ['sim', 'Tenho'],
  ['nao', 'Não tenho'],
];
/** Escala Monk de tom de pele (Google, 2022), 10 tons. */
const MONK = ['#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96', '#a07e56', '#825c43', '#604134', '#3a312a', '#292420'];

export function FairnessScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [groups, setGroups] = useState<GroupResult[] | null>(null);
  const [profile, setProfile] = useState<AuditProfile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState<AuditProfile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = state.userId;
  const load = useCallback(() => {
    if (!userId) return;
    setError(null);
    fetchPersonalAgreement(userId)
      .then(setPersonal)
      .catch((e: Error) => setError(e.message));
    loadAuditProfile(userId)
      .then((p) => {
        setProfile(p);
        setSaved(p);
      })
      .catch((e: Error) => setError(e.message));
    fetchFairnessReport()
      .then((rows) => setGroups(analyzeGroups(rows)))
      .catch((e: Error) => {
        setGroups([]);
        setError(e.message);
      });
  }, [userId]);

  useEffect(load, [load]);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const hasAny = Object.values(saved).some((v) => v !== null);

  const save = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await saveAuditProfile(userId, profile);
      setSaved(profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await deleteAuditProfile(userId);
      setProfile(EMPTY_PROFILE);
      setSaved(EMPTY_PROFILE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = <K extends keyof AuditProfile>(key: K, value: AuditProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: p[key] === value ? null : value }));

  const byAttr = new Map<string, GroupResult[]>();
  (groups ?? []).forEach((g) => byAttr.set(g.attribute, [...(byAttr.get(g.attribute) ?? []), g]));

  return (
    <ScreenScroll>
      <ScreenTitle label="AUDITORIA" title={'A leitura é\njusta com você?'} />

      {error ? (
        <Section top={0}>
          <Txt s={12.5} lh={1.5} c={DANGER}>
            {error}
          </Txt>
        </Section>
      ) : null}

      {/* acerto pessoal */}
      <Section top={4}>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2}>
            Com você
          </Txt>
          {personal === null ? (
            <ActivityIndicator color={T.pri} style={{ marginTop: 14 }} />
          ) : personal.overall.samples === 0 ? (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
              Ainda sem comparação. Faça check-ins com a câmera ligada: o que você diz sentir vira a referência.
            </Txt>
          ) : (
            <>
              <Txt s={30} w={800} c={T.t1} style={{ marginTop: 4 }}>
                {pct(personal.overall.rate)}
              </Txt>
              <Txt s={12} lh={1.5} c={T.t3}>
                dos {personal.overall.samples} check-ins com leitura, a câmera viu o mesmo que você disse.
              </Txt>
              <View style={{ gap: 9, marginTop: 14 }}>
                {Object.entries(personal.byEmotion)
                  .sort((a, b) => b[1].samples - a[1].samples)
                  .map(([emotion, a]) => (
                    <View key={emotion}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Txt s={12} c={T.t2}>
                          Quando lê {EMOTIONS[emotion as EmotionKey]?.label.toLowerCase() ?? emotion}
                        </Txt>
                        <Txt s={12} w={800} c={T.t1}>
                          {pct(a.rate)} · {a.samples}
                        </Txt>
                      </View>
                      <Bar pct={(a.rate ?? 0) * 100} color={T.pri} />
                    </View>
                  ))}
              </View>
            </>
          )}
        </Card>
      </Section>

      {/* comunidade */}
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2}>
            Por grupo (todas as pessoas)
          </Txt>
          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
            Só aparecem grupos com pelo menos 5 pessoas. Um grupo bem abaixo dos outros indica viés do motor — não
            algo errado com quem está nele.
          </Txt>
          {groups === null ? (
            <ActivityIndicator color={T.pri} style={{ marginTop: 14 }} />
          ) : groups.length === 0 ? (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 10 }}>
              Ainda não há pessoas suficientes em nenhum grupo para comparar com segurança.
            </Txt>
          ) : (
            [...byAttr.entries()].map(([attr, rows]) => (
              <View key={attr} style={{ marginTop: 14, gap: 6 }}>
                <Txt s={12} w={800} c={T.t1}>
                  {ATTRIBUTE_LABEL[attr as AuditAttribute] ?? attr}
                </Txt>
                {rows.map((g) => (
                  <View key={g.grp} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt s={12} c={g.flagged ? DANGER : T.t2}>
                      {GROUP_LABEL[g.grp] ?? g.grp} · {g.users} pessoas{g.thin ? ' · poucos dados' : ''}
                    </Txt>
                    <Txt s={12} w={800} c={g.flagged ? DANGER : T.t1}>
                      {pct(g.rate)}
                      {g.flagged ? ' ⚠' : ''}
                    </Txt>
                  </View>
                ))}
              </View>
            ))
          )}
        </Card>
      </Section>

      {/* atributos autodeclarados */}
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2}>
            Ajude a medir (opcional)
          </Txt>
          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
            Responda só o que quiser. Nada disso muda a leitura nem aparece para cuidadores — serve apenas para o
            relatório agregado acima. Pode apagar quando quiser.
          </Txt>

          <Txt s={12} w={700} c={T.t1} style={{ marginTop: 14, marginBottom: 8 }}>
            Óculos
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GLASSES.map(([v, label]) => (
              <Chip key={label} label={label} on={profile.glasses === v} onPress={() => toggle('glasses', v)} />
            ))}
          </View>

          <Txt s={12} w={700} c={T.t1} style={{ marginTop: 14, marginBottom: 8 }}>
            Tom de pele (escala Monk)
          </Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {MONK.map((color, i) => {
              const on = profile.skinTone === i + 1;
              return (
                <Touchable
                  key={color}
                  onPress={() => toggle('skinTone', i + 1)}
                  accessibilityLabel={`Tom ${i + 1} de 10`}
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 999,
                    backgroundColor: color,
                    borderWidth: on ? 3 : 1,
                    borderColor: on ? T.pri : T.bd,
                  }}
                />
              );
            })}
          </View>

          <Txt s={12} w={700} c={T.t1} style={{ marginTop: 14, marginBottom: 8 }}>
            Idade
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AGES.map((v) => (
              <Chip key={v} label={v ?? ''} on={profile.ageBand === v} onPress={() => toggle('ageBand', v)} />
            ))}
          </View>

          <Txt s={12} w={700} c={T.t1} style={{ marginTop: 14, marginBottom: 8 }}>
            Barba
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BEARD.map(([v, label]) => (
              <Chip key={label} label={label} on={profile.facialHair === v} onPress={() => toggle('facialHair', v)} />
            ))}
          </View>

          <PrimaryButton
            label={busy ? 'Salvando…' : dirty ? 'Salvar' : 'Salvo'}
            disabled={!dirty || busy}
            onPress={() => {
              save().catch(() => undefined);
            }}
            style={{ marginTop: 16 }}
          />
          {hasAny ? (
            <Touchable
              onPress={() => {
                erase().catch(() => undefined);
              }}
              accessibilityLabel="Apagar meus dados da auditoria"
              style={{ marginTop: 12, alignSelf: 'center' }}
            >
              <Txt s={12.5} w={800} c={DANGER}>
                Apagar minhas respostas
              </Txt>
            </Touchable>
          ) : null}
        </Card>
      </Section>
    </ScreenScroll>
  );
}
