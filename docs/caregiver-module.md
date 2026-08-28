# Módulo de cuidador

O cuidador acompanha sinais agregados e consentidos; não recebe imagens,
conversas, eventos individuais ou diagnóstico. O produto deve apresentar uma
ausência de dados como ausência de dados, nunca como estabilidade.

## Estado sem a migration

É possível continuar desenvolvendo, testando as telas e usando a navegação
local sem aplicar a migration. Nesse modo, trate o módulo como uma prévia:

- os estados visuais de carregamento, sem dados, falha e acesso indisponível
  continuam disponíveis;
- as métricas puras e a interface podem ser validadas com dados de teste;
- os artefatos que dependem do banco (consentimento persistido, alertas,
  agenda, plano, equipe, notas sincronizadas e auditoria) não devem ser
  considerados ativos nem usados com dados reais;
- qualquer leitura de dados de uma pessoa acompanhada só é segura quando a
  proteção RLS e a RPC agregada abaixo estiverem aplicadas.

Não use uma build sem a migration para acompanhamento real de terceiros. A
ausência da estrutura no banco não pode ser substituída por permissões apenas
na interface.

## Aplicação obrigatória no Supabase

Antes de publicar a versão do app, aplique
[`../supabase/migrations/202608280001_caregiver_foundation.sql`](../supabase/migrations/202608280001_caregiver_foundation.sql).
Ela cria:

- consentimento granular por vínculo;
- consulta RPC de série agregada para cuidador;
- alertas de padrão persistente, sem classificação de emergência;
- check-ins, agenda, plano, equipe, notas privadas, ações de apoio e auditoria;
- políticas RLS para esses artefatos.

As migrations complementares `202608280002` a `202608280010` removem um
índice duplicado, cobrem as chaves estrangeiras do módulo e tornam a auditoria
operacional. Os registros de auditoria contêm apenas ação, data, ator e ID do
artefato; não armazenam conteúdo de notas, respostas, imagens ou evidências.

Após a migration, revise as policies existentes de `emotion_events`: o
cuidador não deve receber uma policy de leitura direta da tabela. As telas de
cuidador usam `care_dashboard_summary`, que valida o escopo `trends` antes de
devolver somente buckets agregados.

## Atualização do painel

O painel atualiza as consultas consentidas a cada 60 segundos e em ações
explícitas da interface. Não há canal Realtime para artefatos de cuidado:
as permissões de Broadcast da extensão do Supabase não podem ser restringidas
com segurança neste projeto. Essa escolha evita transmitir linhas, IDs de
artefatos ou conteúdo sensível após uma revogação.

## Escopos

`summary`, `trends`, `alerts`, `checkins`, `agenda`, `care_plan`,
`support_actions` e `audit` são escolhidos pela pessoa acompanhada em Ajustes
› Conexões. Ela pode alterá-los ou revogar o acesso a qualquer momento.

## Telas entregues

- Painel: carteira multipessoa, atualização, cobertura, alertas e ações.
- Alertas: novo, em acompanhamento e resolvido.
- Dados: 24h, 7 dias e 30 dias; distribuição, cobertura e origem de sinais.
- Agenda: check-ins e compromissos consentidos.
- Plano: sinais combinados, passos, equipe e notas privadas do cuidador.
- Histórico: ações operacionais do módulo, sem conteúdo sensível.

O compartilhamento de relatório é textual e consentido neste momento. Não se
declara exportação em PDF enquanto um artefato PDF verificável não for gerado.

## Fluxo de validação

Antes da migration, valide apenas a experiência local com dados simulados:

1. Execute `npm run test:vision` dentro de `app` para validar as métricas puras.
2. Confira que `menos de 3 leituras`, `zero leituras`, erro e carregamento são
   apresentados como dados indisponíveis, e não como estabilidade.
3. Navegue pelas telas sem inserir dados de outras pessoas em um ambiente que
   não possua RLS validada.

Depois da migration, valide o fluxo completo em um projeto Supabase de teste:

1. Aplique a migration, crie uma pessoa acompanhada e um cuidador de teste.
2. Aceite o vínculo, conceda somente `trends` e confirme que a RPC retorna
   buckets agregados, sem eventos individuais.
3. Remova `trends` e confirme que a RPC falha por escopo; conceda `alerts` e
   valide o ciclo aberto → acompanhado → resolvido.
4. Exercite check-ins, agenda, plano, equipe, ações de apoio e notas privadas
   com os respectivos escopos.
5. Revogue o consentimento e confirme que leituras, realtime e atualizações
   do cuidador deixam de funcionar imediatamente.

## Critérios de validação antes da publicação

1. Exercitar RLS com conta cuidada, cuidador sem consentimento, cuidador com
   consentimento parcial, vínculo revogado e vínculo pendente.
2. Confirmar que revogação bloqueia RPC, alertas e realtime imediatamente.
3. Validar que o dashboard não consulta `emotion_events` diretamente na role
   cuidador.
4. Testar vazio, carregamento, falha de rede e dados desatualizados.
5. Revisar localmente os textos de crise e contatos de emergência para cada
   país de distribuição.
