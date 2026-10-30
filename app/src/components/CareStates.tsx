import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { careName, pickCurrent } from '../care/careSelection';
import { useCareLinks } from '../care/useCareLinks';
import { EXTRA_ICONS, ICONS } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN, hexA } from '../theme/palette';
import { CareLinksErrorCard } from './CareLinksErrorCard';
import { CarePersonPicker } from './CarePersonPicker';
import { Icon } from './Icon';
import { Section } from './ScreenScroll';
import { Card, Touchable, Txt } from './ui';

/** Vínculos do cuidador + a pessoa selecionada, com a regra única de seleção. */
export function useCurrentCareLink(refreshEveryMs?: number) {
  const { state } = useApp();
  const links = useCareLinks(state.userId, 'care', refreshEveryMs);
  const current = pickCurrent(links.links, state.person);
  return { ...links, current, name: current ? careName(current, links.links) : null };
}

export function LoadingCard({ text }: { text: string }) {
  const { T } = useTheme();
  return (
    <Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}>
      <ActivityIndicator color={T.pri} />
      <Txt s={13} c={T.t3} accessibilityLiveRegion="polite">
        {text}
      </Txt>
    </Card>
  );
}

export function ErrorCard({ title, error, onRetry }: { title: string; error: Error; onRetry: () => void }) {
  const { T } = useTheme();
  return (
    <Card radius={24} padding={20} style={{ borderColor: DANGER }}>
      <Txt s={14.5} w={800} c={DANGER} accessibilityRole="alert">
        {title}
      </Txt>
      <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
        {error.message}
      </Txt>
      <CareLinkButton label="Tentar novamente" onPress={onRetry} style={{ marginTop: 6 }} />
    </Card>
  );
}

/** Faixa de erro de uma AÇÃO: não esconde a lista que já está na tela. */
export function ActionError({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Card radius={18} padding={14} style={{ borderColor: DANGER }}>
      <Txt s={12.5} w={800} c={DANGER} accessibilityRole="alert">
        {message}
      </Txt>
      <CareLinkButton label="Entendi" onPress={onClose} />
    </Card>
  );
}

/** Botão de texto com área de toque mínima de 44 px. */
export function CareLinkButton({
  label,
  onPress,
  disabled,
  tone = 'pri',
  hint,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'pri' | 'danger' | 'muted';
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  const color = disabled ? T.t3 : tone === 'danger' ? DANGER : tone === 'muted' ? T.t2 : T.pri;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={[{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 8 }, style]}
    >
      <Txt s={12.5} w={800} c={color}>
        {label}
      </Txt>
    </Touchable>
  );
}

/** Botão secundário em pílula (fundo claro da primária), 44 px. */
export function CarePillButton({
  label,
  onPress,
  disabled,
  danger,
  selected,
  hint,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      style={[
        {
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: 15,
          borderRadius: 999,
          backgroundColor: selected ? T.pri : danger ? hexA(DANGER, 0.12) : T.priL,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Txt s={12.5} w={800} c={selected ? '#fff' /* onPri */ : danger ? DANGER : T.pri}>
        {label}
      </Txt>
    </Touchable>
  );
}

/**
 * Resultado de uma ação, mostrado JUNTO do botão que a disparou (U6).
 * Sucesso some sozinho em 5 s; erro fica até ser fechado.
 */
export function ActionMessage({
  message,
  onClose,
}: {
  message: { text: string; tone: 'ok' | 'error' } | null;
  onClose: () => void;
}) {
  const { T } = useTheme();
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    if (!message || message.tone !== 'ok') return undefined;
    const id = setTimeout(() => closeRef.current(), 5000);
    return () => clearTimeout(id);
  }, [message]);
  if (!message) return null;
  const error = message.tone === 'error';
  return (
    <View
      style={{ marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
      accessibilityLiveRegion={error ? 'assertive' : 'polite'}
    >
      <Icon d={error ? ICONS.alert : ICONS.check} size={14} color={error ? DANGER : OK} circle={error} sw={2.2} />
      <Txt s={12.5} lh={1.45} c={error ? DANGER : T.t1} style={{ flex: 1 }} accessibilityRole={error ? 'alert' : 'text'}>
        {message.text}
      </Txt>
      {error ? (
        <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar mensagem" hitSlop={12}>
          <Txt s={12} w={800} c={T.t3}>
            Fechar
          </Txt>
        </Touchable>
      ) : null}
    </View>
  );
}

/** Dado desatualizado: o erro de atualização NÃO apaga o que já está na tela (C5). */
export function StaleNotice({ at, onRetry }: { at: number | null; onRetry: () => void }) {
  const { T } = useTheme();
  const when = at ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Card radius={16} padding={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: WARN }}>
      <Icon d={EXTRA_ICONS.cloud} size={16} color={T.t2} />
      <Txt s={12} lh={1.4} c={T.t2} style={{ flex: 1 }} accessibilityLiveRegion="polite">
        {when ? `Sem conexão agora — mostrando dados de ${when}.` : 'Sem conexão agora — mostrando o que já estava carregado.'}
      </Txt>
      <CareLinkButton label="Atualizar" onPress={onRetry} />
    </Card>
  );
}

/** Aviso discreto: o servidor ainda não tem a migration desta função. */
export function UnavailableNotice({ text }: { text: string }) {
  const { T } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 16, backgroundColor: T.priL }}>
      <Icon d={ICONS.help} size={15} color={T.pri} />
      <Txt s={12} lh={1.45} c={T.t2} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

/** Estado vazio com orientação e, opcionalmente, um próximo passo. */
export function EmptyCard({ title, text, action }: { title: string; text: string; action?: { label: string; onPress: () => void } }) {
  const { T } = useTheme();
  return (
    <Card radius={24} padding={20}>
      <Txt s={14.5} w={800} c={T.t1} accessibilityRole="summary">
        {title}
      </Txt>
      <Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>
        {text}
      </Txt>
      {action ? <CarePillButton label={action.label} onPress={action.onPress} style={{ alignSelf: 'flex-start', marginTop: 12 }} /> : null}
    </Card>
  );
}

/**
 * Portão comum das telas do cuidador: seletor de pessoa, carregando, erro e
 * "sem ninguém conectado" (sempre com um caminho para criar o convite). Só
 * renderiza o conteúdo com uma pessoa selecionada de verdade.
 */
export function CareGate({
  care,
  emptyText,
  children,
}: {
  care: ReturnType<typeof useCurrentCareLink>;
  emptyText: string;
  children: (current: CaregiverLink, name: string) => React.ReactNode;
}) {
  const { actions } = useApp();
  if (care.loading && care.links.length === 0) {
    return (
      <Section top={0}>
        <LoadingCard text="Carregando conexões…" />
      </Section>
    );
  }
  if (care.error && care.links.length === 0) {
    return (
      <Section top={0}>
        <CareLinksErrorCard error={care.error} onRetry={care.refresh} />
      </Section>
    );
  }
  if (!care.current || !care.name) {
    return (
      <Section top={0}>
        <EmptyCard
          title={emptyText}
          text="Gere um convite em Mais e envie para a pessoa. O acompanhamento começa quando ela aceitar."
          action={{ label: 'Criar convite', onPress: () => actions.go('caretools') }}
        />
      </Section>
    );
  }
  return (
    <>
      <CarePersonPicker links={care.links} />
      {children(care.current, care.name)}
    </>
  );
}
