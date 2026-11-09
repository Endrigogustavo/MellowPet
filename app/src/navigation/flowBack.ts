import { Alert } from 'react-native';

import type { Actions } from '../state/AppContext';

/**
 * "Voltar" do cadastro de cuidador, o da tela e o físico: volta um passo; no
 * primeiro, a conta já existe, então voltar é sair dela — e isso só com
 * confirmação (antes o da tela saía direto e o físico pulava para o Painel).
 */
export function stepBackCareSignup(step: number, actions: Pick<Actions, 'set' | 'logout'>): void {
  if (step > 0) {
    actions.set((s) => ({ careStep: Math.max(0, s.careStep - 1) }));
    return;
  }
  Alert.alert(
    'Sair da conta?',
    'Sua conta de cuidador já foi criada. Você pode entrar de novo depois e gerar o convite na aba Mais.',
    [
      { text: 'Continuar cadastro', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => actions.logout().catch(() => undefined) },
    ]
  );
}
