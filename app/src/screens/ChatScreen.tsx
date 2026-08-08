import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiService } from '../services/api';
import { useAppStore } from '../hooks/useStore';
import { Colors, Typography, Spacing, Radius, Shadow, EMOTION_COLORS } from '../theme';

const QUICK_PROMPTS = [
  'Me ajuda a relaxar agora',
  'O que posso fazer em 5 minutos?',
  'Sugere uma rotina para hoje',
  'Quero entender meu padrão emocional',
];

export const ChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const petName = useAppStore((state) => state.settings.petName);
  const petType = useAppStore((state) => state.settings.petType);
  const chatHistory = useAppStore((state) => state.chatHistory);
  const addChatMessage = useAppStore((state) => state.addChatMessage);
  const clearChatHistory = useAppStore((state) => state.clearChatHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerLabel, setProviderLabel] = useState('fallback');
  const listRef = useRef<FlatList>(null);

  const petIconMap: Record<string, string> = {
    dog: 'dog-side',
    cat: 'cat',
    bunny: 'rabbit',
    bear: 'teddy-bear',
    fox: 'paw',
    panda: 'yin-yang',
    owl: 'bird',
    seal: 'seal',
  };
  const petIcon = petIconMap[petType] || 'robot-outline';
  const themeMeta = EMOTION_COLORS.neutral;

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    addChatMessage({ role: 'user', content: text });
    setLoading(true);

    try {
      const response = await ApiService.chat(
        text,
        useAppStore.getState().currentEmotion.emotion,
        useAppStore.getState().currentEmotion.confidence,
        chatHistory.map((m) => ({ role: m.role, content: m.content })),
      );
      setProviderLabel(response.provider);
      addChatMessage({ role: 'assistant', content: response.response });
    } catch {
      addChatMessage({
        role: 'assistant',
        content: 'Opa, tive um problema técnico. Tente novamente!',
      });
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, chatHistory, addChatMessage]);

  const sendQuickPrompt = useCallback((text: string) => {
    setInput(text);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, []);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = ({ item }: { item: typeof chatHistory[0] }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: themeMeta.light }]}>
            <MaterialCommunityIcons name={petIcon as any} size={18} color={Colors.primary} />
          </View>
        )}
        {isUser ? (
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleUser, Shadow.sm]}
          >
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.content}</Text>
            <Text style={styles.bubbleTimeUser}>{formatTime(item.timestamp)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleBot, Shadow.sm]}>
            <Text style={styles.bubbleText}>{item.content}</Text>
            <Text style={styles.bubbleTimeBot}>{formatTime(item.timestamp)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#F8F9FB', '#F1F4FF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name={petIcon as any} size={30} color={Colors.primary} />
          <View>
            <Text style={styles.headerTitle}>{petName}</Text>
            <Text style={styles.headerSub}>
              {providerLabel === 'openai'
                ? 'IA ativa: OpenAI'
                : providerLabel === 'anthropic'
                  ? 'IA ativa: Anthropic'
                  : 'IA em modo fallback'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearChatHistory} style={styles.clearBtn}>
          <MaterialCommunityIcons name="broom" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <FlatList
          ref={listRef}
          data={chatHistory}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <MaterialCommunityIcons name={petIcon as any} size={56} color={Colors.primary} />
              <Text style={styles.emptyChatText}>
                Olá! Estou aqui para te apoiar em tempo real. Como posso te ajudar agora?
              </Text>

              <View style={styles.quickPromptsWrap}>
                {QUICK_PROMPTS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.quickPromptChip}
                    onPress={() => sendQuickPrompt(prompt)}
                  >
                    <Text style={styles.quickPromptText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />

        {loading && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>{petName} está digitando...</Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputRow, Shadow.sm, { marginBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Como você está se sentindo?"
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() ? Colors.primary : Colors.borderLight },
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.xs, color: Colors.textTertiary },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  messageList: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xl, paddingTop: Spacing.md },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginBottom: Spacing.sm },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: {
    maxWidth: '79%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
  },
  bubbleBot: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomLeftRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubbleUser: {
    borderBottomRightRadius: Radius.sm,
  },
  bubbleText: { fontSize: Typography.base, color: Colors.textPrimary, lineHeight: 22 },
  bubbleTextUser: { color: Colors.textInverse },
  bubbleTimeBot: {
    marginTop: 4,
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    alignSelf: 'flex-end',
  },
  bubbleTimeUser: {
    marginTop: 4,
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.8)',
    alignSelf: 'flex-end',
  },
  typingIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm,
  },
  typingText: { fontSize: Typography.sm, color: Colors.textTertiary },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.xl,
  },
  input: {
    flex: 1, backgroundColor: Colors.background,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    fontSize: Typography.base, color: Colors.textPrimary,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyChat: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md },
  quickPromptsWrap: {
    width: '100%',
    marginTop: Spacing.sm,
    gap: 8,
  },
  quickPromptChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: Spacing.base,
  },
  quickPromptText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyChatText: {
    fontSize: Typography.base, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },
});
