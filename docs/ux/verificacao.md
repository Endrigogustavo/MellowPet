# Verificação independente — Fase 5 (Agente K)

Branch `feat/cuidador-ux-navegacao` em `fe3ce31`. Revisão só por leitura de código e pelos comandos abaixo. Não usei o celular, não rodei build Android e não apliquei a migration. Nenhum código de produção foi alterado.

## 1. Comandos

| Comando | Resultado |
|---|---|
| `app/` `npx tsc --noEmit -p tsconfig.json` | ✅ exit 0, sem erros |
| `app/` `npx eslint src` | ✅ exit 0, sem avisos |
| `app/` `node --no-warnings --test --experimental-strip-types tests/*.test.mjs` | ✅ 271 testes, 271 passam, 0 falham |
| `api/` `venv\Scripts\python.exe -m pytest -q` | ✅ exit 0, 244 testes e todos passam. Nenhum `x`: os 10 `xfail` da Fase 2 viraram testes normais. O `-q` do projeto não imprime a linha de resumo. |
| `app/` `npx expo export --platform android --output-dir <scratch>` | ✅ exit 0, bundle Hermes `index-….hbc` (4,12 MB) e 5 fontes. A pasta de saída foi apagada e nenhum servidor ficou rodando. |

## 2. Itens Críticos e Altos de `problemas.md`

Todos foram conferidos no código. A coluna Status de `problemas.md` traz os mesmos arquivos e linhas.

| # | Status | Evidência / ressalva |
|---|---|---|
| N1 | ✅ | `navModel.ts:16-88` (SCREEN_ACCESS/canAccess) e o reducer `AppContext.tsx:458-483` desviam toda troca de tela. O guard de render fica em `RootNavigator.tsx:120`. A NowPlayingBar aparece só no perfil usuário (`:175`). As ações do Chat também passam pelo guard (`AppContext.tsx:1459`). |
| N2 | ✅ | `applyDestination` checa `canAccess` (`AppContext.tsx:699`), e o reducer checa de novo. |
| N3 | ✅ | `subscribeToSignOut` zera `pendingScreen` (`:885`) e o estado volta ao `INITIAL` com `history: []` (`:887-900`). |
| N4 | ✅ | `flowBack.ts:10-22` é usado pelo botão da tela e pelo voltar físico (`RootNavigator.tsx:140-143`). No passo 0, sair da conta pede confirmação. |
| N5 | ✅ | `deepLinks.ts:14-85` cobre `care`, `carealerts`, `agenda`, `tools` e `settings`, além de `tool?action=` e `playlist?id=`. |
| N6 | ✅ | `replace('music')` no fim dos fluxos. Check-in ↔ Mapa sem ciclo (`CheckinScreen.tsx:506` + `pushHistory`). Na Home, o voltar sai do app (`RootNavigator.tsx:144`). |
| N7 | ✅ | O push leva `cared_user_id` (`care-push/index.ts:153`) e o app seleciona o vínculo antes de abrir a tela (`AppContext.tsx:709-714`). |
| N8 | ✅ | O link morto saiu de Ajustes. O Guia e o tour citam caminhos que existem (`CareGuideScreen.tsx:10-15`, `content.ts:506`). |
| C1 | ✅ | `CareRequestsBanner` fica fora do ramo pausa/erro/carregando (`CareScreen.tsx:325-328`). |
| C2 | ⚠️ | O código está correto: policy `care_link_even_paused` (`care_ux.sql:509-521`), push para vínculos pausados (`care-push/index.ts:105-143`) e texto honesto (`CaredPresence.tsx:42-53`). **Só funciona depois de aplicar a migration.** Sem ela, o pedido feito durante a pausa continua invisível para o cuidador. |
| C3 | ✅ | O carinho aparece indisponível na pausa, com explicação (`CarePresence.tsx:221-248`). |
| C4 | ✅ | O formulário é preenchido uma vez e remontado por pessoa via `key` (`CarePlanScreen.tsx:53,77-87`). Salvar atualiza só a memória (`:133`). A Agenda limpa os campos só depois de salvar (`AgendaScreen.tsx:110`). |
| C5 | ✅ | O erro fica por pessoa e não apaga o último dado. Aparece `StaleNotice` (`CareScreen.tsx:36-106,344-348`). |
| C6 | ✅ | "Zona de perigo" no fim do painel, com confirmação (`CareScreen.tsx:470-495`). |
| C7 | ✅ | `CareDateTimeField` com `@react-native-community/datetimepicker`, que já era dependência. |
| C8 | ✅ | Ajustes listam todos os vínculos, com pausar e encerrar em cada um (`CareConnections.tsx:118-150`). |
| C9 | ⚠️ | A prévia (`AcceptInviteScreen.tsx`) e a RPC `accept_invite_with_consent` (`care_ux.sql:448-503`) estão corretas. Sem a migration aplicada, o app cai no `accept_invite` antigo e o termo não é registrado (`careUxClient.ts:232`). Isso é avisado na tela de sucesso. Ver também o achado M3. |
| C10 | ✅ | O widget recebe só a contagem de alertas (`widgetBridge.ts:125-134`, `CareScreen.tsx:178-183`). Ver o achado M1. |
| A1 | ✅ | Padrões de 3ª pessoa em `crisis.py:13-39` e `crisis.ts:15-36`, com testes passando nos dois lados. |
| A2 | ✅ | `unknown` passou a ser aceito (`api/routers/care.py:21-24,95`). |
| A3 | ✅ | UPDATE em `care_requests` só nas colunas de confirmação, com gatilho que fixa quem e quando (`care_ux.sql:525-559`). Gestos com vínculo ativo (`:565-575`). Auditoria restrita (`:579-590`). As tentativas que falham contam desde `202610290001:9-56`. |
| U1 | ✅ | `onPri` nos dois temas (`palette.ts:42-44,67-68`). Restam 2 textos `#fff` sobre vermelho (B7). |
| U2 | ✅ | `ScreenScroll.tsx:28` + `useKeyboardAwareScroll`. |
| U3 | ✅ | `ui.tsx:154-190`: role padrão, hitSlop até 44 px e opacidade composta com o feedback de toque. |
| U4 | ✅ | Toggle com `switch`, Chip e Segmented com `selected`, TabBar com `tab`/`selected` (`TabBar.tsx:65-67`). |
| U5 | ⚠️ parcial | O `t3` foi corrigido (4,83:1 no claro, `palette.ts:38-41`). Restam 7 textos < 11 px: `CareDataScreen.tsx:113` (9 px), `TabBar.tsx:77` (9,5 px), e 10,5 px em `CareAlertsScreen.tsx:117,124`, `CareDataScreen.tsx:84`, `CareSignupScreen.tsx:115` e `CarePersonPicker.tsx:28`. Eram cerca de 45. |
| U6 | ✅ | `ActionMessage` junto do botão em Agenda, Plano, Notas, Conexões, Ajustes e Grupos. |

## 3. Roteiro de navegação (leitura de código)

**Perfil usuário.** As abas são Home, Ferramentas, Rotina, Música e Bem-estar, e o Chat abre pela TabBar. As telas internas mostram "Voltar" no título quando `showsBackButton` permite. No voltar físico, `RootNavigator.tsx:126-152` faz o seguinte:
- na Home, sai do app;
- nas outras abas, vai para a Home;
- nas demais telas, volta pelo `popHistory`, que pula entradas proibidas e de NO_HISTORY.

As telas novas do usuário são alcançáveis:
- `acceptinvite`: por Ajustes → Conexões (`CareConnections.tsx:87`), pela Home quando o cadastro trouxe código (`HomeScreen.tsx:307`) e por `caredcare` (`CaredCareScreen.tsx:63`);
- `caredcare`: por Ajustes → Conexões, quando há vínculo (`CareConnections.tsx:156`).

**Perfil cuidador.** As abas são Painel, Alertas, Dados, Agenda e Mais. As telas novas são alcançáveis:
- `carehistory`: atalhos do Painel (`CareScreen.tsx:213,412`) e Mais (`CareToolsScreen.tsx:124`);
- `carenotes`: Painel, Mais, Plano (`CarePlanScreen.tsx:268`) e Histórico (`CareHistoryScreen.tsx:149`);
- `carealertrules`: Alertas (`CareAlertsScreen.tsx:70`) e Mais;
- `carenotify`: só por Mais (`CareToolsScreen.tsx:127`);
- `careaudit` e `careguide`: por Mais.

**Resultado:**
- Toda tela nova tem um caminho de UI e uma saída ("Voltar" do título ou o voltar físico).
- Nenhuma tela de um perfil abre no outro: o guard fica no reducer e no render.
- Deep links e notificações passam por `openExternal` → `canAccess`, e o destino espera o restore da sessão.
- O logout zera o histórico e o destino pendente.

Ressalvas de navegação (Baixo):
- **B1**: `AcceptInviteScreen.tsx:90` diz "Voltar aos ajustes", mas `finish` faz `back()`, que leva à Home quando a pessoa veio da Home.
- **B2**: `Notifications.getLastNotificationResponse()` é usado sem `clearLastNotificationResponse()` (`AppContext.tsx:1022-1023`). Se o provider remontar no mesmo processo, a última notificação pode reabrir a tela.
- **B3**: se a pessoa do push não está mais nos vínculos, por exemplo porque revogou, `applyDestination` abre Alertas com a pessoa selecionada antes, sem aviso (`AppContext.tsx:712-713`).

## 4. Privacidade e banco

**Só aditiva.** Não há `DROP TABLE`, `DROP COLUMN` nem `DELETE` de dados. Os únicos `drop` são de policies e triggers, recriados logo em seguida. Os `UPDATE` só preenchem `note_day` e `caregiver_link_id` em notas antigas, dentro de um bloco idempotente. A migration é reexecutável (`if not exists`, `create or replace`, `drop … if exists`).

**Consentimento e revogação.** Leitura de cada tabela e RPC pelo cuidador:

| Tabela / RPC | Corta ao revogar | Corta na pausa | Observação |
|---|---|---|---|
| `care_history` (RPC) | ✅ `care_link_for` | ✅ | `security definer`, `search_path=''`, checa `auth.uid()`; só agregados por período |
| `caregiver_notes` | ✅ | ✅ (as notas ficam guardadas) | ver B4 |
| `care_notification_prefs` | ✅ `is_own_care_link` | não (decisão: são preferências do próprio cuidador) | não checa `expires_at` (B5) |
| `care_alert_rules` | ✅ | não (idem) | idem |
| `care_consents` | ⚠️ **não** | não | a policy (`care_ux.sql:462-469`) não exige vínculo ativo (B6) |
| `care_requests` | ✅ `care_link_even_paused` | **não, de propósito** (plano §2, documentado em `care_ux.sql:505-508` e no topo de `care-push`) | o cuidador vê também pedidos anteriores ao aceite (B8) |
| `care_gestures` (leitura) | ✅ (corrigido) | ✅ | |
| `care_audit_log` | ✅ (corrigido) | ✅ | |
| gatilho de alerta | ✅ | ✅ | ver B9 |

**Funções `security definer`.** Todas as novas têm `set search_path` e checam `auth.uid()`: `care_link_even_paused`, `is_own_care_link`, `caregiver_note_defaults`, `care_history`, `accept_invite_with_consent`, `enforce_care_request_ack`, `create_persistent_signal_alert` e `pause_care_sharing`. As de `private` têm `revoke` de `public`/`anon`, e as RPCs públicas só têm `grant` para `authenticated`.

**Sintaxe SQL (revisão sem Postgres).** Não achei erro provável:
- `#variable_conflict use_column` está no início do corpo, e as colunas OUT (`bucket`, `total`…) não colidem com os aliases dos CTEs (`b`, `n_total`…);
- `generate_series(timestamp, timestamp, interval)`, `make_interval(mins => …)`, o operador `jsonb ? text` e `!~` resolvem com `search_path=''`, porque `pg_catalog` é implícito;
- `accept_invite` devolve `to_jsonb(link)`, então `v_result ->> 'id'` existe;
- `disable trigger user` dentro do `DO` é válido com o dono da tabela.

Risco residual: `care_history` declara `top_emotion text`. Se `emotion_events.emotion` for `varchar` ou enum, o `return query` falha com "structure of query does not match". O schema base não está no repositório. As RPCs de grupos já devolvem `emotion text` vindo da mesma coluna, o que indica que é `text`.

**`/care/weekly`.** O endpoint aceita só agregados: `extra="forbid"`, contagens por dia, `open_alerts` e uma relação de até 40 letras. Leituras, nomes e textos da pessoa não entram (`api/routers/care.py:156-203`).

## 5. Qualidade das telas novas

Histórico, Anotações, Regras, Notificações, "Do meu cuidador" e Aceite:
- todas têm carregando, erro com "Tentar novamente", vazio e dado desatualizado (`StaleNotice`);
- todas tratam a pausa e remontam por pessoa (`key={current.id}` + `useCareResource`, que descarta respostas atrasadas);
- sem `any` (grep em `screens/Care*`, `care/*` e `components/Care*`).

Degradação sem a migration:
- leituras caem no padrão com `unavailable: true` e aviso na tela;
- escritas ficam desabilitadas com "Este recurso ainda não foi ativado no servidor";
- o histórico usa o resumo diário antigo em UTC, com aviso;
- as notas funcionam sem a coluna `note_day`.

## 6. Achados novos

Nenhum Crítico. Nenhum Alto de código. Há um Alto **operacional**.

| # | Prior. | Achado | Onde | Correção sugerida |
|---|---|---|---|---|
| OP1 | **Alto (operacional)** | O APK novo promete coisas que dependem de `202610300001_care_ux.sql`. Sem a migration: o pedido "Preciso de você" na pausa não chega e a pessoa lê que chega (C2); o aceite não grava o termo (C9); o cuidador ainda pode alterar qualquer coluna de `care_requests` e ler gestos depois de revogar (A3). | `supabase/migrations/202610300001_care_ux.sql` | Aplicar a migration (e fazer o deploy de `care-push`) antes de entregar o APK, e então testar aceite, pausa + pedido e revogação. |
| M1 | Médio | O widget do cuidador nunca é limpo. Depois do logout, da revogação ou da pausa, continua mostrando o nome da pessoa, o índice e a contagem de alertas na tela inicial do aparelho. Na pausa, `summary` vira `null` e o efeito não roda. | `CareScreen.tsx:176-184`; `widgetBridge.ts` não tem função de limpar | Criar `clearCareWidgets()` e chamá-la no `subscribeToSignOut` (`AppContext.tsx:881`). No `CareScreen`, quando a pessoa atual está pausada ou some dos vínculos, mandar `people: []`. |
| M2 | Médio | Uma escrita de nota negada pela RLS (`42501`), porque a pessoa pausou ou revogou durante a edição, é mostrada como "Este recurso ainda não foi ativado no servidor". | `careUxClient.ts:111-116` | Tratar `42501` à parte: "O compartilhamento foi pausado ou encerrado; a anotação não foi salva." |
| M3 | Médio | O consentimento pode ser contornado: `public.accept_invite` continua executável por `authenticated`, então um cliente pode aceitar sem gravar `care_consents`. Além disso, `isCareConfigurationMissing` casa qualquer "does not exist" e pode cair no fallback sem registro do termo por um erro que não é de migration ausente. | `care_ux.sql:502-503`; `careUxClient.ts:232`; `careErrors.ts:28-33` | Depois de aplicar, `revoke execute on function public.accept_invite(text) from authenticated` (a RPC nova chama como definer). No app, só cair no fallback com `PGRST202` ou `42883` citando `accept_invite_with_consent`. |
| B4 | Baixo | As notas são filtradas por `cared_user_id`, não pelo vínculo: notas de um vínculo revogado reaparecem se houver um convite novo. O UPDATE permite trocar `cared_user_id`, e o `caregiver_link_id` antigo é mantido. | `care_ux.sql:171-179`, `:147-148` | Fixar `cared_user_id` no gatilho de UPDATE (`new.cared_user_id := old.cared_user_id`). Decidir se notas de vínculos antigos devem voltar. |
| B5 | Baixo | `is_own_care_link` não checa `expires_at`. | `care_ux.sql:38-50` | Acrescentar `and (l.expires_at is null or l.expires_at > now())`. |
| B6 | Baixo | O cuidador revogado continua lendo `care_consents` do vínculo (versão do termo e data). | `care_ux.sql:462-469` | Exigir `l.revoked_at is null` na policy. |
| B7 | Baixo | Texto `#fff` sobre `#E5484D`/DANGER (cerca de 3,9:1) em 12,5–13 px. | `ChatScreen.tsx:305`, `PlaylistDetailScreen.tsx:570` | Escurecer o fundo ou usar 14 px bold. |
| B8 | Baixo | `care_requests_read` mostra ao cuidador pedidos criados antes do vínculo dele ser aceito. | `care_ux.sql:509-514` | Exigir `created_at >= accepted_at` do vínculo (variante do helper que devolva `accepted_at`). |
| B9 | Baixo | Retomar com `p_hours=0` grava `paused_until = null`, e as leituras feitas durante a pausa voltam a contar para o alerta. | `care_ux.sql:298,621` | Guardar `resumed_at`/`last_paused_until` ou usar `now()` como fim da pausa ao retomar. |
| B10 | Baixo | Histórico: se todas as leituras de um período são `unknown`, a barra fica vazia, sem segmento. | `CareHistoryScreen.tsx:100-107` | Desenhar um segmento neutro "sem leitura clara". |
| B11 | Baixo | O Guia do cuidador fala em "acesso integral ao módulo de cuidado", o que contradiz a prévia (só agregados). | `CareGuideScreen.tsx:11` | Trocar para "acesso aos sinais agregados, alertas, plano e agenda". |
| B12 | Baixo | Mais tem dois itens "Histórico": a auditoria (`careaudit`) e o histórico de sinais. | `content.ts:415`, `CareToolsScreen.tsx:124` | Renomear a auditoria para "Registro de atividades". |
| B13 | Baixo | Deep link do widget do pet com o app frio, antes do restore: `role` ainda é `null`, então o XP e o humor entram no estado local mesmo se a conta for de cuidador. | `AppContext.tsx:917,974-981` | Guardar a ação como destino pendente e decidir depois do restore. |
| B1–B3 | Baixo | Ver a seção 3. | | |

## 7. Veredito

**APROVADO COM RESSALVAS.**

Os 27 Críticos e Altos estão resolvidos no código (24 ✅ e 3 ⚠️). Os ⚠️ são C2 e C9, que só valem depois de aplicar a migration, e U5, que ficou parcial com 7 textos < 11 px. Os comandos passam, o bundle gera e a migration é aditiva, sem erro de sintaxe aparente. A condição para liberar é OP1: aplicar `202610300001_care_ux.sql` e publicar `care-push` antes de entregar o APK. Os achados M1–M3 devem entrar na próxima rodada.
