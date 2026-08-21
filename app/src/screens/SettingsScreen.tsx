import React from 'react';
import { View } from 'react-native';

import { Field } from '../components/Field';
import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Toggle, ToggleRow, Touchable, Txt, useColumnWidth } from '../components/ui';
import { NO_FACE_MINUTES, SETTING_TOGGLES } from '../data/content';
import { PET_TYPES } from '../data/pets';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN, mix } from '../theme/palette';

export function SettingsScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full } = useTheme();
  const petWidth = useColumnWidth(3, 8, 16 + 18); // margem da tela + padding do cartão

  const toggles = full ? SETTING_TOGGLES : SETTING_TOGGLES.slice(0, 3);

  const linkLabel = state.linked
    ? 'Conectado'
    : state.pairPending
      ? 'Aguardando você aceitar'
      : 'Não conectado';
  const linkColor = state.linked ? OK : state.pairPending ? WARN : T.t3;

  return (
    <ScreenScroll>
      <ScreenTitle label="AJUSTES" title="Do seu jeito" />

      {/* bichinho */}
      <Section top={0}>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2} style={{ marginBottom: 9 }}>
            Nome do bichinho
          </Txt>
          <Field
            variant="filled"
            value={state.petName}
            onChangeText={(petName) => actions.set({ petName })}
            style={{ fontSize: 15, fontWeight: '700' }}
          />

          <Txt s={12} w={800} c={T.t2} style={{ marginTop: 16, marginBottom: 9 }}>
            Aparência
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PET_TYPES.map(([id, label, color]) => {
              const on = id === state.petType;
              return (
                <Touchable
                  key={id}
                  onPress={() => actions.set({ petType: id })}
                  style={{
                    width: petWidth,
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: on ? T.priL : T.bg,
                  }}
                >
                  <PetFace
                    size={34}
                    petType={id}
                    body={isDark ? mix(color, '#FFFFFF', 0.14) : color}
                  />
                  <Txt s={11} w={700} c={on ? T.pri : T.t2}>
                    {label}
                  </Txt>
                </Touchable>
              );
            })}
          </View>
        </Card>
      </Section>

      {/* conexões */}
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2} style={{ marginBottom: 12 }}>
            Conexões
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: T.priL,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt s={15} w={800} c={T.pri}>
                M
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt s={14} w={700} c={T.t1}>
                Marina Ribeiro
              </Txt>
              <Txt s={11.5} w={700} c={linkColor} style={{ marginTop: 2 }}>
                {linkLabel}
              </Txt>
            </View>
            {state.linked ? (
              <Touchable
                onPress={() => actions.set({ linked: false, pairPending: false })}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: T.bd,
                }}
              >
                <Txt s={11.5} w={800} c={T.t2}>
                  Desconectar
                </Txt>
              </Touchable>
            ) : null}
            {state.pairPending && !state.linked ? (
              <Touchable
                onPress={() => actions.set({ linked: true, pairPending: false })}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: T.pri,
                }}
              >
                <Txt s={11.5} w={800} c="#fff">
                  Aceitar
                </Txt>
              </Touchable>
            ) : null}
          </View>

          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 11 }}>
            A conexão é sempre sua escolha. Ao desconectar, o painel dela fica vazio na hora.
          </Txt>

          <Touchable
            onPress={() => actions.setRole('care')}
            style={{
              marginTop: 14,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: T.priL,
            }}
          >
            <Txt s={13.5} w={800} c={T.pri}>
              Entrar no modo cuidador
            </Txt>
          </Touchable>
        </Card>
      </Section>

      {/* preferências */}
      <Section>
        <Card radius={24} padding={18} style={{ paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 }}>
            <View style={{ flex: 1 }}>
              <Txt s={14.5} w={700} c={T.t1}>
                Modo silencioso
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
                Sem avisos em aula ou reunião - a leitura continua
              </Txt>
            </View>
            <Toggle on={state.quiet} onPress={() => actions.set((s) => ({ quiet: !s.quiet }))} />
          </View>

          {toggles.map(([key, label, sub]) => (
            <ToggleRow
              key={key}
              label={label}
              sub={sub}
              on={!!state.toggles[key]}
              divider
              onPress={() =>
                actions.set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } }))
              }
            />
          ))}
        </Card>
      </Section>

      {full ? (
        <>
          <Section>
            <Card radius={24} padding={18}>
              <Txt s={14.5} w={700} c={T.t1}>
                Alerta sem rosto
              </Txt>
              <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                Avisar após {state.noFaceMin} min sem detecção
              </Txt>
              <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>
                {NO_FACE_MINUTES.map((m) => {
                  const on = m === state.noFaceMin;
                  return (
                    <Touchable
                      key={m}
                      onPress={() => actions.set({ noFaceMin: m })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 13,
                        alignItems: 'center',
                        backgroundColor: on ? T.priL : T.bg,
                      }}
                    >
                      <Txt s={12.5} w={700} c={on ? T.pri : T.t2}>
                        {m}m
                      </Txt>
                    </Touchable>
                  );
                })}
              </View>
            </Card>
          </Section>

          <Section>
            <Card radius={24} padding={18}>
              <Txt s={14.5} w={700} c={T.t1}>
                Contatos de emergência
              </Txt>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    backgroundColor: T.priL,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt s={15} w={800} c={T.pri}>
                    A
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt s={14} w={700} c={T.t1}>
                    Ana Ribeiro
                  </Txt>
                  <Txt s={11.5} c={T.t3}>
                    ana.ribeiro@email.com
                  </Txt>
                </View>
              </View>
              <Touchable
                style={{
                  marginTop: 14,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: T.priL,
                }}
              >
                <Txt s={14} w={800} c={T.pri}>
                  + Adicionar contato
                </Txt>
              </Touchable>
            </Card>
          </Section>
        </>
      ) : null}

      <Section top={16}>
        <Touchable
          onPress={() => actions.go('splash')}
          style={{
            paddingVertical: 15,
            borderRadius: 18,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,.35)',
          }}
        >
          <Txt s={14} w={700} c={DANGER}>
            Reiniciar sessão
          </Txt>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
