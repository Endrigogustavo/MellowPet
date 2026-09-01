# Módulo de cuidador

Um vínculo de cuidador aceito libera integralmente o módulo de cuidado para
esse cuidador. Não existem permissões separadas por tela, métrica ou ação.
Imagens, conversas e eventos emocionais individuais continuam fora do painel:
as tendências são fornecidas somente pela RPC agregada e não constituem um
diagnóstico.

## Regra de acesso

O acesso é concedido automaticamente quando o convite é aceito e permanece
ativo enquanto o vínculo estiver:

- com status `accepted`;
- não revogado;
- não expirado.

A pessoa acompanhada não configura escopos de acesso. Ela ainda pode encerrar
o vínculo inteiro, e o cuidador também pode encerrar o próprio acompanhamento.
Isso remove o acesso imediatamente e preserva a trilha de auditoria.

## Banco de dados

As migrations `202608280001` a `202608290011` criam os artefatos de cuidado,
RLS, alertas, agenda, plano, equipe, notas, ações e auditoria. A migration
`202608290011_caregiver_full_link_access.sql` substitui o consentimento
granular por autorização integral baseada no vínculo aceito. A tabela legada
`caregiver_consents` permanece somente como histórico interno e não fica
acessível pelo cliente.

As telas de cuidador usam `care_dashboard_summary`, que devolve somente dados
agregados. Não deve ser criada policy de leitura direta de `emotion_events`
para cuidadores.

## Atualização do painel

O painel atualiza dados a cada 60 segundos e após ações explícitas. Não há
canal Realtime para os artefatos de cuidado: o Broadcast privado não pôde ser
restrito com segurança nesta configuração do Supabase.

## Telas entregues

- Painel: pessoas acompanhadas, tendências, alertas e ações rápidas.
- Alertas: novo, em acompanhamento e resolvido.
- Dados: 24 h, 7 dias e 30 dias; distribuição, cobertura e origem de sinais.
- Agenda: check-ins e compromissos.
- Plano: sinais, passos, equipe e notas privadas do cuidador.
- Histórico: ações operacionais, sem conteúdo sensível.

## Validação antes da publicação

1. Aceite um convite e confirme acesso a todas as telas do módulo.
2. Confirme que vínculo pendente, revogado ou expirado não acessa RPC, alertas
   nem artefatos de cuidado.
3. Confirme que o dashboard não consulta `emotion_events` diretamente na role
   cuidador.
4. Teste vazio, carregamento, falha de rede e dados desatualizados.
5. Revise textos de crise e contatos de emergência para cada país de
   distribuição.
