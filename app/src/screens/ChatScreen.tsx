import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { MellowMark } from '../components/PetFace';
import { Touchable, Txt } from '../components/ui';
import { ICONS, QUICK_PROMPTS } from '../data/content';
import {
  CARE_CHAT_EMPTY_MESSAGE,
  CARE_CHAT_PLACEHOLDER,
  CARE_CHAT_PROMPTS,
  caregiverReply,
} from '../data/caregiverContent';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useApp, useTheme } from '../state/AppContext';
import { font } from '../theme/type';
import { ACTION_LABEL } from '../chat/actions';
import { ChatModelPicker } from '../components/ChatModelPicker';
import { fetchCareDashboardSummary } from '../care/careClient';
import { signalScore } from '../care/careDashboard';
import { askCopilot, type CopilotSummary } from '../care/presenceClient';
import { useCareResource } from '../care/useCareResource';
import { useCurrentCareLink } from '../components/CareStates';

/** Um dos três pontinhos de "digitando" — keyframe `mp-dots`. */
function Dot({ delay, color }: { delay: number; color: string }) {
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [delay, v]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0.25, 1, 0.25, 0.25] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, -4, 0, 0] }) },
        ],
      }}
    />
  );
}

export function ChatScreen() {
  const { state, actions } = useApp();
  const { T, emo, emoColor, emoLight } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const keyboard = useKeyboardHeight();
  const isCare = state.role === 'care';

  // Rola para a última mensagem — e também quando o teclado abre, para a
  // conversa não ficar escondida atrás dele.
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [state.messages.length, state.typing, keyboard]);

  // Resumo agregado da pessoa selecionada, para o copiloto do cuidador.
  const care = useCurrentCareLink();
  const caredId = isCare ? (care.current?.cared_user_id ?? null) : null;
  const careData = useCareResource(caredId, () => fetchCareDashboardSummary(caredId!, 24 * 7));
  const careSummary: CopilotSummary | null = careData.data
    ? {
        period: '7 dias',
        events: careData.data.events,
        score: signalScore(careData.data),
        top_emotion: [...careData.data.distribution].sort((a, b) => b.count - a.count)[0]?.emotion ?? null,
        difficult_share: careData.data.events
          ? careData.data.distribution
              .filter((d) => ['sad', 'angry', 'disgusted', 'fearful'].includes(d.emotion))
              .reduce((sum, d) => sum + d.count, 0) / careData.data.events
          : 0,
      }
    : null;

  const canSend = state.chatInput.trim().length > 0;
  const prompts = isCare ? CARE_CHAT_PROMPTS : QUICK_PROMPTS;
  const send = () => {
    if (!isCare) {
      actions.send();
      return;
    }
    const text = state.chatInput.trim();
    if (!text || state.typing || state.replying) return;
    const history = state.messages;
    actions.set({ chatInput: '', typing: true, replying: true, messages: [...history, { role: 'user', content: text }] });
    const reply = (content: string) =>
      actions.set((cur) => ({ typing: false, replying: false, messages: [...cur.messages, { role: 'bot', content }] }));
    // Copiloto com IA: recebe só o resumo agregado do painel. Sem servidor ou
    // sem IA, as respostas prontas de antes continuam valendo.
    askCopilot(text, history, careSummary)
      .then((answer) => reply(answer ?? caregiverReply(text)))
      .catch(() => reply(caregiverReply(text)));
  };

  return (
    <View style={{ flex: 1 }}>
      {/* cabeçalho */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingTop: insets.top + 10,
          paddingBottom: 14,
          paddingHorizontal: 18,
          borderBottomWidth: 1,
          borderBottomColor: T.bd,
        }}
      >
        <Touchable
          onPress={() => actions.back() || actions.goTab(state.role === 'care' ? 'care' : 'home')}
          accessibilityLabel="Voltar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            backgroundColor: T.surf,
            borderWidth: 1,
            borderColor: T.bd,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={ICONS.back} size={16} color={T.t1} sw={2.2} />
        </Touchable>

        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
          backgroundColor: isCare ? T.priL : emoLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MellowMark size={24} color={isCare ? T.pri : emoColor} faceColor={T.surf} smile={false} />
        </View>

        <View style={{ flex: 1 }}>
          <Txt s={15} w={800} c={T.t1}>
            {isCare ? 'Apoio ao cuidador' : state.petName}
          </Txt>
          <Txt s={11.5} c={T.t3}>
            {isCare ? 'Conversa para organizar apoio com respeito' : `sabe que você está ${emo.label.toLowerCase()}`}
          </Txt>
        </View>

        <Touchable
          onPress={() => actions.set({ messages: [] })}
          accessibilityLabel="Limpar conversa"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            backgroundColor: T.surf,
            borderWidth: 1,
            borderColor: T.bd,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={ICONS.trash} size={15} color={T.t3} sw={1.9} />
        </Touchable>
      </View>

      {/* O cuidador recebe respostas fixas de apoio; não há modelo a escolher. */}
      {!isCare ? <ChatModelPicker /> : null}

      {/* conversa */}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingHorizontal: 16, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {state.messages.length === 0 && !state.typing ? (
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 26, paddingHorizontal: 10 }}>
            <Txt s={14.5} lh={1.65} c={T.t2} center>
              {isCare
                ? CARE_CHAT_EMPTY_MESSAGE
                : 'Estou aqui. Você pode escrever uma frase só — eu organizo o resto com você.'}
            </Txt>
            <View style={{ width: '100%', gap: 8, marginTop: 4 }}>
              {prompts.map((text) => (
                <Touchable
                  key={text}
                  onPress={() => actions.set({ chatInput: text })}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: T.bd,
                    backgroundColor: T.surf,
                    alignItems: 'center',
                  }}
                >
                  <Txt s={13} c={T.t2}>
                    {text}
                  </Txt>
                </Touchable>
              ))}
            </View>
          </View>
        ) : null}

        {state.messages.map((m, i) => {
          const bot = m.role === 'bot';
          return (
            <View
              key={i}
              style={{
                flexDirection: bot ? 'row' : 'row-reverse',
                gap: 8,
                alignItems: 'flex-end',
              }}
            >
              {bot ? (
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    backgroundColor: isCare ? T.priL : emoLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MellowMark size={19} color={isCare ? T.pri : emoColor} faceColor={T.surf} smile={false} />
                </View>
              ) : null}
              <View
                style={{
                  maxWidth: '78%',
                  paddingVertical: 12,
                  paddingHorizontal: 15,
                  backgroundColor: bot ? T.surf : T.pri,
                  ...(bot ? { borderWidth: 1, borderColor: T.bd } : null),
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  borderBottomLeftRadius: bot ? 8 : 22,
                  borderBottomRightRadius: bot ? 22 : 8,
                }}
              >
                <Txt
                  s={14}
                  lh={1.55}
                  w={bot ? 400 : 600}
                  c={bot ? T.t1 : T.onPri}
                >
                  {m.content}
                </Txt>
                {bot && m.source === 'device' ? (
                  <Txt s={11} w={800} c={T.t3} ls={0.8} style={{ marginTop: 5 }}>
                    NO APARELHO · NADA FOI ENVIADO
                  </Txt>
                ) : bot && m.source === 'server' ? (
                  <Txt s={11} w={800} c={T.t3} ls={0.8} style={{ marginTop: 5 }}>
                    NUVEM
                  </Txt>
                ) : null}
                {bot && m.source === 'crisis' ? (
                  <Touchable
                    onPress={actions.sos}
                    accessibilityLabel="Preciso de ajuda"
                    style={{
                      marginTop: 10,
                      alignSelf: 'flex-start',
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: '#E5484D',
                    }}
                  >
                    <Txt s={12.5} w={800} c="#fff">
                      Preciso de ajuda
                    </Txt>
                  </Touchable>
                ) : null}
                {bot && m.action ? (
                  <Touchable
                    onPress={() => m.action && actions.runChatAction(m.action)}
                    accessibilityLabel={ACTION_LABEL[m.action]}
                    style={{
                      marginTop: 10,
                      alignSelf: 'flex-start',
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: T.pri,
                    }}
                  >
                    <Txt s={12.5} w={800} c={T.onPri}>
                      {ACTION_LABEL[m.action]}
                    </Txt>
                  </Touchable>
                ) : null}
              </View>
            </View>
          );
        })}

        {state.typing ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingLeft: 38 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Dot delay={0} color={T.t3} />
              <Dot delay={180} color={T.t3} />
              <Dot delay={360} color={T.t3} />
            </View>
            <Txt s={12} c={T.t3}>
              {isCare ? 'Preparando uma sugestão' : `${state.petName} está escrevendo`}
            </Txt>
          </View>
        ) : null}
      </ScrollView>

      {/* campo de envio */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 10,
          // Com o teclado aberto a barra de navegação fica atrás dele, então a
          // safe area de baixo dá lugar à altura do teclado.
          paddingBottom: keyboard > 0 ? keyboard + 8 : Math.max(insets.bottom, 12) + 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 7,
            paddingLeft: 8,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: T.bd,
            backgroundColor: T.surf,
          }}
        >
          <TextInput
            value={state.chatInput}
            onChangeText={(chatInput) => actions.set({ chatInput })}
            onSubmitEditing={send}
            placeholder={isCare ? CARE_CHAT_PLACEHOLDER : 'Como você está agora?'}
            placeholderTextColor={T.t3}
            returnKeyType="send"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14.5,
              fontFamily: font(400),
              color: T.t1,
              paddingVertical: 11,
              paddingHorizontal: 10,
            }}
          />
          <Touchable
            onPress={send}
            disabled={!canSend}
            accessibilityLabel="Enviar"
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? T.pri : T.bd,
            }}
          >
            <Icon d={ICONS.send} size={19} color={canSend ? T.onPri : T.t3} sw={2.3} />
          </Touchable>
        </View>
      </View>
    </View>
  );
}
