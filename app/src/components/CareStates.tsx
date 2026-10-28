import React from 'react';
import { ActivityIndicator } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { careName, pickCurrent } from '../care/careSelection';
import { useCareLinks } from '../care/useCareLinks';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';
import { CareLinksErrorCard } from './CareLinksErrorCard';
import { CarePersonPicker } from './CarePersonPicker';
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
      <Touchable onPress={onRetry} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 12 }}>
        <Txt s={12.5} w={800} c={T.pri}>
          Tentar novamente
        </Txt>
      </Touchable>
    </Card>
  );
}

/** Faixa de erro de uma AÇÃO: não esconde a lista que já está na tela. */
export function ActionError({ message, onClose }: { message: string; onClose: () => void }) {
  const { T } = useTheme();
  return (
    <Card radius={18} padding={14} style={{ borderColor: DANGER }}>
      <Txt s={12.5} w={800} c={DANGER} accessibilityRole="alert">
        {message}
      </Txt>
      <Touchable onPress={onClose} accessibilityRole="button" style={{ marginTop: 8 }}>
        <Txt s={11.5} w={800} c={T.pri}>
          Entendi
        </Txt>
      </Touchable>
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
  const { T } = useTheme();
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
        <Card radius={24} padding={20}>
          <Txt s={14.5} w={800} c={T.t1}>
            {emptyText}
          </Txt>
          <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
            Gere um convite em Recursos e envie para a pessoa. O acompanhamento começa quando ela aceitar.
          </Txt>
          <Touchable
            onPress={() => actions.go('caretools')}
            accessibilityRole="button"
            style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: T.priL }}
          >
            <Txt s={12.5} w={800} c={T.pri}>
              Criar convite
            </Txt>
          </Touchable>
        </Card>
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
