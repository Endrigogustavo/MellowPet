import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { EMOTIONS, type EmotionKey } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { supabase } from '../supabase/client';
import { DANGER } from '../theme/palette';

/**
 * Modo escola/clínica. Participante: entra por código, sai quando quiser.
 * Coordenador: cria o grupo e vê só a distribuição agregada — e só com 5+
 * pessoas com leituras (a RPC garante; aqui só explicamos).
 */
type Group = { id: string; name: string; code: string; owner_id: string };
/** Faixa de pessoas (não o número exato) e a fração de cada emoção, já arredondada. */
type Row = { members_band: string; emotion: string; share: number };

/** Mensagens do servidor em português, sem jargão de banco. */
function friendly(m: string): string {
  if (/does not exist|PGRST20[25]|schema cache/i.test(m)) return 'Os grupos ainda não estão disponíveis. Tente mais tarde.';
  if (/not found/i.test(m)) return 'Código não encontrado. Confira as 8 letras e números.';
  if (/owner cannot join/i.test(m)) return 'Você coordena este grupo, então não entra nele como participante.';
  if (/invalid group name/i.test(m)) return 'O nome do grupo precisa ter de 2 a 60 caracteres.';
  if (/network|fetch/i.test(m)) return 'Sem conexão agora. Tente de novo.';
  return 'Não foi possível concluir. Tente de novo.';
}

export function GroupsScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<Record<string, Row[] | 'few'>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('care_groups').select('id, name, code, owner_id').order('created_at');
    if (e) setError(friendly(e.message));
    else setGroups((data ?? []) as Group[]);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Trava de envio: dois toques não criam dois grupos.
  const once = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  };

  const join = () =>
    once(async () => {
      const { error: e } = await supabase.rpc('join_care_group', { group_code: code });
      if (e) setError(friendly(e.message));
      else {
        setCode('');
        await load();
      }
    });

  const create = () =>
    once(async () => {
      const { error: e } = await supabase.rpc('create_care_group', { group_name: name.trim() });
      if (e) setError(friendly(e.message));
      else {
        setName('');
        await load();
      }
    });

  const leave = (g: Group) =>
    Alert.alert(`Sair de ${g.name}?`, 'Para voltar, você vai precisar do código de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () =>
          once(async () => {
            const { error: e } = await supabase.from('care_group_members').delete().eq('group_id', g.id).eq('user_id', state.userId ?? '');
            if (e) setError(friendly(e.message));
            await load();
          }),
      },
    ]);

  const view = async (g: Group) => {
    const { data, error: e } = await supabase.rpc('care_group_summary', { gid: g.id, days: 7 });
    if (e) setError(friendly(e.message));
    else setSummary((s) => ({ ...s, [g.id]: data && data.length > 0 ? (data as Row[]) : 'few' }));
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="GRUPOS" title={'Escola, clínica\nou equipe'} />
      <Section top={0}>
        <Txt s={12.5} lh={1.55} c={T.t2}>
          Quem coordena vê só o clima geral do grupo — nunca o de uma pessoa — e só quando há pelo menos 5 pessoas com
          leituras. Você pode sair a qualquer momento.
        </Txt>
        {error ? (
          <Txt s={12} lh={1.45} c={DANGER} style={{ marginTop: 8 }}>
            {error}
          </Txt>
        ) : null}
      </Section>

      {groups.length === 0 ? (
        <Section>
          <Txt s={12.5} lh={1.5} c={T.t3}>
            Você ainda não participa de nenhum grupo. Entre com o código que recebeu ou crie um, se for coordenar.
          </Txt>
        </Section>
      ) : null}
      {groups.map((g) => {
        const mine = g.owner_id === state.userId;
        const s = summary[g.id];
        return (
          <Section key={g.id}>
            <Card radius={22} padding={16}>
              <Txt s={14} w={800} c={T.t1}>
                {g.name}
              </Txt>
              <Txt s={11.5} c={T.t3}>
                {mine ? `Você coordena · código ${g.code}` : 'Você participa'}
              </Txt>
              {mine ? (
                <>
                  <PrimaryButton label="Ver clima dos últimos 7 dias" onPress={() => view(g).catch(() => undefined)} style={{ marginTop: 10 }} />
                  {s === 'few' ? (
                    <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 8 }}>
                      Menos de 5 pessoas com leituras (contam só membros com 7+ dias no grupo) — por privacidade, nada é mostrado.
                    </Txt>
                  ) : s ? (
                    <View style={{ gap: 6, marginTop: 10 }}>
                      <Txt s={11.5} c={T.t3}>
                        Faixa de {s[0].members_band} pessoas com leituras · valores arredondados
                      </Txt>
                      {s.map((r) => (
                        <View key={r.emotion}>
                          <Txt s={12} c={T.t2}>
                            {EMOTIONS[r.emotion as EmotionKey]?.label ?? r.emotion} · {Math.round(r.share * 100)}%
                          </Txt>
                          <Bar pct={r.share * 100} color={T.pri} height={5} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Touchable onPress={() => leave(g)} accessibilityLabel={`Sair de ${g.name}`} style={{ marginTop: 10 }}>
                  <Txt s={12.5} w={800} c={DANGER}>
                    Sair do grupo
                  </Txt>
                </Touchable>
              )}
            </Card>
          </Section>
        );
      })}

      <Section>
        <Card radius={22} padding={16}>
          <Field label="Entrar com código" placeholder="ABCD2345" value={code} onChangeText={(t) => setCode(t.toUpperCase().slice(0, 8))} autoCapitalize="characters" />
          <PrimaryButton label={busy ? 'Entrando…' : 'Entrar'} disabled={code.length < 8 || busy} onPress={() => join().catch(() => undefined)} style={{ marginTop: 10 }} />
        </Card>
      </Section>
      <Section>
        <Card radius={22} padding={16}>
          <Field label="Criar um grupo (coordenador)" placeholder="Turma 3ºB, Grupo de quinta…" value={name} onChangeText={(t) => setName(t.slice(0, 60))} />
          <PrimaryButton label={busy ? 'Criando…' : 'Criar'} disabled={name.trim().length < 2 || busy} onPress={() => create().catch(() => undefined)} style={{ marginTop: 10 }} />
        </Card>
      </Section>
    </ScreenScroll>
  );
}
