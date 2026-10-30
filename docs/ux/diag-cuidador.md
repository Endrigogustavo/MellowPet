# Diagnóstico da área do cuidador (MellowPet)

Branch analisada: `feat/cuidador-ux-navegacao` (HEAD `5371f56`). Data: 2026-10-30.
Escopo: somente leitura do código; nenhuma alteração de produção.

**Stack real** (o briefing que fala em SQLite está errado): app Expo/React Native/TS em `app/`. Dados no Supabase (Postgres com RLS, RPCs e gatilhos) em `supabase/migrations/`. Push via Edge Function `supabase/functions/care-push`. A API FastAPI (`api/`) só cuida de IA, e no cuidado só existe o copiloto `api/routers/care.py`.
O perfil cuidador é `state.role === 'care'`. Só entra nele quem tem `accountRole === 'care'` (`app/src/state/AppContext.tsx:1210-1219`).

---

## 1. Inventário de telas e componentes do cuidador

### Navegação
- Abas do cuidador: Painel (`care`), Alertas (`carealerts`), Dados (`dashboard`), Agenda (`agenda`), Mais (`caretools`) (`app/src/components/TabBar.tsx:19-25`). Há também um botão flutuante para o chat (`TabBar.tsx:81-82`).
- A rota `dashboard` vira `CareDataScreen` quando o perfil é cuidador (`app/src/navigation/RootNavigator.tsx:87-90`). A tela inicial do cuidador é `care` (`RootNavigator.tsx:102`).
- Toque em notificação: `care_alert(s)` abre `carealerts` e `care_request(s)` abre `care` (`AppContext.tsx:903-913`). A notificação não diz **qual pessoa** gerou o aviso, então o app não seleciona ninguém.

### Telas

| Tela / componente | O que faz | Dados (função cliente → tabela/RPC) | Arquivo |
|---|---|---|---|
| **CareScreen** (Painel) | Carrossel de pessoas, card "Encerrar acompanhamento", pedidos de contato, banner do alerta ativo, "Resumo de sinais" (índice 0-100 e frase), tendência de 7 dias, carinho, bem-estar do cuidador, chave "Só o resumo da semana", atalhos | `useCareLinks` → `listLinks` → `caregiver_links`; `fetchCareDashboardSummary(…, 168)` → RPC `care_dashboard_summary`; `listCareAlerts` → `care_alerts`; `revokeCareLink` → RPC `revoke_care_link`; `registerPushToken` → `push_tokens`; `updateCareWidgets` (widget Android) | `app/src/screens/CareScreen.tsx:41-165` |
| CarePresence → `ValenceTrend` | Barras empilhadas agradável/neutro/difícil, só dos últimos 7 dias | `summary.daily` (RPC) | `app/src/components/CarePresence.tsx:28-93` (`slice(-7)` em :30) |
| CarePresence → `CareRequestsBanner` | Pedido "preciso de você" ainda não atendido, com notificação local e botão "Vi, vou falar" | `listOpenRequests` / `acknowledgeRequest` → `care_requests` | `CarePresence.tsx:96-153` |
| CarePresence → `GestureCard` | Envia "Pensando em você", "Um abraço" ou "Estou por perto" | `sendGesture` → `care_gestures` (insert) | `CarePresence.tsx:156-198` |
| CarePresence → `WeeklySummaryCard` | Semana em 3 frases e uma sugestão de conversa, **por regras** (sem IA) | `weekSummary` (`app/src/care/careWeekly.ts:41-78`) | `CarePresence.tsx:201-219` |
| CarePresence → `useWeeklyMode` / `usePanelOpens` | Preferência de modo semanal e contagem de aberturas no dia, guardadas só no aparelho | SecureStore | `CarePresence.tsx:225-254` |
| CarePresence → `CaregiverWellbeingCard` | "E você, como está?", aviso a partir de 8 aberturas, respiração de 1 min, CVV | só estado local; o sentimento não é salvo (`:261`) | `CarePresence.tsx:257-337` |
| CarePresence → `PausedCard` | Mostra "Compartilhamento pausado até…" | `link.paused_until` | `CarePresence.tsx:340-360` |
| **CareAlertsScreen** | Lista de alertas. Fluxo: aberto → "Marcar como visto" → resolver com retorno (útil / falso alarme / já sabia) | `listCareAlerts`, `updateCareAlert` → `care_alerts`; `giveAlertFeedback` → RPC `give_alert_feedback`; `createSupportAction` → `care_support_actions` | `app/src/screens/CareAlertsScreen.tsx:23-169` |
| **CareDataScreen** (aba Dados) | Períodos de 24h / 7 dias / 30 dias: índice, frase, barras de cobertura por dia (máx. 14), distribuição por emoção, origem dos registros e botão para compartilhar o resumo | `fetchCareDashboardSummary(…, 24/168/720)` → RPC | `app/src/screens/CareDataScreen.tsx:25-211` |
| **AgendaScreen** | Agenda check-in (pergunta + data/hora digitada como texto) e compromisso (título + início); lista os próximos | `listCareCheckins`/`createCareCheckin` → `care_checkins`; `listCareAppointments`/`createCareAppointment` → `care_appointments` | `app/src/screens/AgendaScreen.tsx:30-255` |
| **CarePlanScreen** | Plano (título, sinais de atenção, próximos passos), equipe de cuidado (nome + função) e **notas privadas** | `fetchCarePlan`/`saveCarePlan` → `care_plans` (upsert); `listCareTeam`/`createCareTeamMember` → `care_team_members`; `listPrivateNotes`/`createPrivateNote` → `caregiver_notes` | `app/src/screens/CarePlanScreen.tsx:44-304` |
| **CareAuditScreen** | Histórico operacional: só categoria e horário, no máximo 80 itens | `listCareAuditEntries` → `care_audit_log` (`id, action, created_at`) | `app/src/screens/CareAuditScreen.tsx:13-76`, `app/src/care/careAudit.ts` |
| **CareToolsScreen** (Mais) | Atalhos (`CARE_TOOLS`), guia, código de convite (reaproveita um pendente ou cria outro **sem nome**), CVV | `getOrCreatePendingInvite` → `caregiver_links` | `app/src/screens/CareToolsScreen.tsx:13-251`, `app/src/data/content.ts:409-416` |
| **CareGuideScreen** | Guia estático em 4 passos | — | `app/src/screens/CareGuideScreen.tsx` |
| **CareSignupScreen** | Cadastro do cuidador em 3 passos: nome e vínculo, aviso de "acesso integral", código | `createInvite` → `caregiver_links` (insert com `cared_name` e `relationship`) | `app/src/screens/CareSignupScreen.tsx:20-307` |
| **ChatScreen** (modo cuidador) | "Apoio ao cuidador". Manda a pergunta e um resumo agregado de 7 dias ao copiloto; sem IA, usa respostas prontas | `fetchCareDashboardSummary` → RPC; `askCopilot` → `POST /api/v1/care/chat`; fallback `caregiverReply` (`app/src/data/caregiverContent.ts:19`) | `app/src/screens/ChatScreen.tsx:68-112` |
| SettingsScreen (perfil cuidador) | A seção "Conexões" fica **oculta** para o cuidador (`:270`). Só sobram ajustes genéricos (modo silencioso, exibição, widgets) | — | `app/src/screens/SettingsScreen.tsx:268-575` |

### Infraestrutura do cliente
- `useCareLinks` separa "sem vínculos" de "erro ao consultar" e faz polling opcional (`app/src/care/useCareLinks.ts`). O painel atualiza a cada 60 s (`CareScreen.tsx:45`, `:107-112`).
- `useCareResource` descarta respostas atrasadas e limpa os dados ao trocar de pessoa (`app/src/care/useCareResource.ts`).
- `CareGate` é o portão comum: carregando, erro, "sem pessoa" com botão "Criar convite", e o seletor de pessoa (`app/src/components/CareStates.tsx:75-129`).
- `careSelection.ts` define a regra única de pessoa selecionada. Sem `cared_name`, a pessoa aparece como "Pessoa acompanhada N" (`app/src/care/careSelection.ts:10-20`).
- `careErrors.ts`: quando falta uma migration, a tela mostra "Configuração do cuidador ainda não foi ativada".
- `careDashboard.ts` / `careMetrics.ts`: índice `50 + (positivo − difícil)/total × 50`, só com 3 ou mais leituras (`careMetrics.ts:6-13`), e as frases do insight (`careDashboard.ts:30-43`).
- **Código morto:** `listSupportActions` não é usado em lugar nenhum (`app/src/care/careClient.ts:340`). `CARE_SCOPES` e `CARE_QUICK` sobraram do modelo antigo de consentimento por escopo (`app/src/data/content.ts:380-401`). `summary.hourly` chega da RPC e não é usado (`careClient.ts:192`).

---

## 2. Modelo de dados do vínculo

### Tabelas

| Tabela | Conteúdo | Origem |
|---|---|---|
| `caregiver_links` | `invite_code`, `caregiver_user_id`, `cared_user_id`, `cared_name`, `relationship`, `status` (pending/accepted), `accepted_at`, `revoked_at`, `expires_at`, `requested_scopes` (ignorado), `paused_until` | A tabela base **não está nas migrations** (só aparece em `supabase/README.md:16`). As colunas novas estão em `202608280001_caregiver_foundation.sql:10-14` e `202610280002_caregiver_presence.sql:12` |
| `caregiver_consents` | Legado de consentimento por escopo; o cliente não acessa mais | `foundation.sql:16-26`; travado em `202608290011:98-102` e `202608290012` (policy restritiva `false`) |
| `care_alerts` | Alerta por vínculo (`kind`, `severity`, `title`, `detail`, `evidence` jsonb, status, ack/resolve, `feedback`) | `foundation.sql:28-45`, `presence.sql:132-134` |
| `care_checkins` | Check-in agendado (`prompt`, `scheduled_for`, `status`, `response`) | `foundation.sql:51-63` |
| `care_appointments` | Compromisso (`title`, `starts_at`, `ends_at`, `notes`) | `foundation.sql:68-79` |
| `care_plans` | **Uma linha por pessoa acompanhada** (`unique cared_user_id`), compartilhada entre todos os cuidadores | `foundation.sql:84-93` |
| `care_team_members` | Equipe (nome, função, contato, `can_receive_alerts`) | `foundation.sql:95-105` |
| `caregiver_notes` | Notas privadas (`caregiver_user_id`, `cared_user_id`, `body`); **não têm data de referência nem categoria** | `foundation.sql:107-114` |
| `care_support_actions` | Ações de apoio (`kind`, `detail`, `outcome`) | `foundation.sql:116-126` |
| `care_audit_log` | `action`, `actor_user_id` e `metadata` (record_id), gravados por gatilho | `foundation.sql:128-136`; gatilhos em `202608280004` e `202608280005` |
| `care_gestures` | Carinho (`kind`, `seen_at`), no máximo 6 por dia por vínculo | `presence.sql:265-305` |
| `care_requests` | "Preciso de você" (`urgency`, `acknowledged_*`), no máximo 5 por hora. **Não guarda o vínculo**: vale para a pessoa, não para um cuidador | `presence.sql:308-347` |
| `push_tokens` | Token Expo por usuário | `presence.sql:350-362` |
| `private.invite_attempts` | Limite de 10 aceites por hora | `202610280001_review_hardening.sql:55-59` |

### Autorização (RLS e funções auxiliares)
- `private.care_link_for(cared)` devolve o link do cuidador atual quando ele está aceito, não revogado, não expirado e **não pausado** (`presence.sql:14-27`).
- `private.care_scope_enabled(cared, escopo)` ignora o escopo. É verdadeiro para a própria pessoa ou para qualquer cuidador com link ativo e não pausado (`presence.sql:29-45`; o comentário em `202608290011:104-105` diz que existe só por compatibilidade). Na prática, **o acesso é tudo ou nada**.
- Policies:
  - `care_alerts`: a pessoa ou o cuidador **do próprio link** (`review_hardening.sql:16-34`).
  - `care_checkins`, `care_appointments`, `care_support_actions`: a pessoa (com acesso total) ou o cuidador do link (`foundation.sql:532-579`).
  - `care_plans` e `care_team_members`: a pessoa e **todos** os cuidadores ativos (`foundation.sql:552-559`).
  - `caregiver_notes`: só o autor, e só enquanto o link está ativo e não pausado (`foundation.sql:560-569`).
  - `care_audit_log`: SELECT para a pessoa e todos os cuidadores ativos (`foundation.sql:580-582`).
  - `emotion_events`: só o dono. O cuidador só lê pela RPC agregada (`foundation.sql:586-589`).
  - `caregiver_links`: as duas partes leem. O cuidador só insere `pending`. DELETE revogado (`review_hardening.sql:36-38`).
- Gatilhos de integridade: o autor é sempre `auth.uid()` e os metadados são imutáveis (`foundation.sql:354-401`). O alerta só segue open→acknowledged→resolved, ou muda apenas o feedback (`presence.sql:200-243`).

### RPCs
- `care_dashboard_summary(p_cared_user_id, p_hours ≤ 2160)` devolve `events`, `last_event_at`, `mean_confidence`, `distribution`, `hourly` (com emoção dominante **por hora**), `daily` (agradável/neutro/difícil) e `sources` (`presence.sql:67-129`).
- `accept_invite(code)`: limite de tentativas, validade de 72 h e `expires_at = null` após o aceite (`review_hardening.sql:61-97`).
- `revoke_care_link(link_id)`: qualquer uma das partes revoga e o histórico fica (`202608280006`).
- `pause_care_sharing(link, 0|24|168)`: só a pessoa acompanhada (`presence.sql:48-64`).
- `give_alert_feedback(alert, feedback)`: só o cuidador do link (`presence.sql:247-262`).
- Gatilho `create_persistent_signal_alert`: 3 leituras difíceis em 90 min, ou 4 em 2 h se houve 3 ou mais falsos alarmes em 30 dias. Um alerta por vínculo a cada 6 h. Não gera alerta durante a pausa (`presence.sql:136-196`).

### Ciclo do consentimento
1. **Convite:** o **cuidador** gera `MEL-XXXXX-XXXXX` (cerca de 50 bits) (`careClient.ts:54-77`). Vale 72 h por gatilho (`review_hardening.sql:41-53`).
2. **Aceite:** a pessoa digita o código em Ajustes (`SettingsScreen.tsx:198-207`, `:529-550`) ou no cadastro (`AppContext.tsx:1258-1266`). O link passa a `accepted` sem prazo.
3. **Pausa:** 24 h ou 7 dias. O cuidador continua vendo o link com `paused_until` e perde o acesso aos dados.
4. **Revogação:** por qualquer parte, com `revoked_at`. Não há reativação: é preciso um convite novo.
5. **Escopos:** não existem mais. O texto "acesso integral" aparece em `CareSignupScreen.tsx:191-195` e `SettingsScreen.tsx:569`.

### O que o cuidador pode e não pode ver
- **Vê:** os agregados da RPC (até 90 dias, inclusive por hora e por origem `background_vision`); alertas do próprio link com `title`, `detail` e **`evidence`** (`latest_emotion`, porque `select('*')` em `careClient.ts:198-207`); check-ins, inclusive o campo `response`; compromissos; plano; equipe; ações de apoio do próprio link; o log de auditoria de todos os cuidadores (o app lê só `action` e `created_at`, mas a RLS também libera `actor_user_id` e `metadata`); pedidos de contato; e `paused_until`.
- **Não vê:** eventos individuais de emoção, conversas com o pet, fotos, `checkins` pessoais (outra tabela) e notas de outros cuidadores. Durante a pausa, não vê nada além do próprio link, **nem as próprias notas**.

---

## 3. Lado da pessoa acompanhada

| Ação | Como funciona hoje | Arquivo |
|---|---|---|
| Convidar | **Não existe.** Ela só aceita o código gerado pelo cuidador | `SettingsScreen.tsx:529-550` |
| Aceitar | Campo de código em Ajustes (o placeholder `MEL-4821` está no formato antigo) ou no cadastro. O erro `too_many_attempts` (54000) não tem mensagem própria | `SettingsScreen.tsx:532-534`, `careClient.ts:111-126` |
| Saber o que vai compartilhar **antes** de aceitar | **Não há tela.** O aviso "acesso integral" só aparece **depois** que o vínculo existe | `SettingsScreen.tsx:569` |
| Ver o cuidador | Nome ou e-mail do **primeiro** link apenas (`links[0]`) | `SettingsScreen.tsx:209-213`, `:470-479` |
| Pausar e retomar | `PauseSharing`, só no primeiro link | `CaredPresence.tsx:166-219`, `SettingsScreen.tsx:505` |
| Revogar | "Desconectar" → `revoke_care_link`, só no primeiro link | `SettingsScreen.tsx:215-245` |
| Ver o que o cuidador vê | `CareMirrorScreen`: índice, frase, 7 dias e títulos dos alertas | `app/src/screens/CareMirrorScreen.tsx` |
| Pedir contato | `NeedYouCard` na Home | `CaredPresence.tsx:26-98`, `HomeScreen.tsx:311` |
| Receber carinho | `GestureDelivery` na Home, com polling de 60 s | `CaredPresence.tsx:104-163`, `HomeScreen.tsx:305` |
| Ver plano, check-ins, compromissos, equipe e histórico | **Não existe UI.** A RLS deixa ela ler e editar tudo, mas nenhuma tela mostra | — |

Com mais de um cuidador, a Settings só gerencia o primeiro. Além disso, o campo de código some quando já existe um vínculo (`SettingsScreen.tsx:529`), então ela não consegue aceitar um segundo cuidador por ali.

---

## 4. Lacunas

### Itens pedidos no briefing

| Item | Status | Evidência |
|---|---|---|
| **Painel com várias pessoas e estado recente** | **Parcial** | O carrossel existe (`CareScreen.tsx:142-147`), mas só a pessoa selecionada é carregada. As outras mostram "toque para ver" (`CareScreen.tsx:33-39`). Não há "última atividade", alertas por pessoa nem pedidos por pessoa na visão geral. O widget só recebe a pessoa atual (`CareScreen.tsx:126`), embora aceite 2 (`app/src/widgets/widgetBridge.ts:116`). |
| **Histórico dia/semana/mês com gráficos** | **Parcial** | Existem as abas 24h/7d/30d (`CareDataScreen.tsx:13-17`) e as barras de cobertura, mas cortadas em 14 dias (`:111`), então "30 dias" mostra só 14. Não há gráfico por hora para "24h": `hourly` é ignorado. A tendência por humor só existe para 7 dias (`CarePresence.tsx:30`). Não há comparação entre semanas nem navegação por dias passados. O bucket `date_trunc('day', created_at)` é em **UTC** (`presence.sql:100`): leituras depois de 21h (BRT) caem no dia seguinte. |
| **Alertas com regras configuráveis** | **Não existe** | Há uma única regra fixa no gatilho (`presence.sql:136-196`), com ajuste automático por falso alarme (`:160-166`). Não há UI, tabela de regras nem outros tipos (`kind`). Severidade sempre `attention`. Sem paginação nem filtro (`careClient.ts:198-207`). |
| **Resumo/insight semanal por IA, não diagnóstico** | **Parcial** | O resumo semanal é **por regras**, não por IA (`careWeekly.ts:41-78`), e só aparece com a chave "Só o resumo da semana" ligada (`CareScreen.tsx:153`, `:159`). Existe IA apenas no copiloto, sob demanda (`api/routers/care.py:91-103`). Nenhum resumo semanal é gerado ou guardado, e não há push semanal. |
| **ANOTAÇÕES do cuidador por pessoa e por dia** | **Parcial** | Há notas por pessoa (`CarePlanScreen.tsx:258-294`, `caregiver_notes`), mas **não há vínculo com um dia** (só `created_at`) nem categoria ou humor observado. Só as **4 últimas** aparecem (`CarePlanScreen.tsx:283`). Não dá para editar, apagar ou buscar. As notas ficam escondidas dentro de "Plano", e o atalho "Equipe e notas" também leva a `careplan` (`content.ts:414`). Não aparecem no histórico nem ao lado dos dias do gráfico. Ficam ilegíveis durante a pausa e depois da revogação (RLS `foundation.sql:560-569`). |
| **Configurações de notificação** | **Não existe** | O token de push é registrado sozinho ao abrir o painel, sem opt-in próprio (`CareScreen.tsx:56-58`). Avisos locais saem só com o app aberto (`CareScreen.tsx:69-74`, `CarePresence.tsx:107-116`). O push remoto depende de configurar webhooks à mão (`supabase/functions/care-push/index.ts:7-11`) e de `eas.projectId` (`app/src/care/presenceClient.ts:125-129`). Não há preferência por tipo, pessoa, horário silencioso ou urgência. A Settings do cuidador não tem nada disso (`SettingsScreen.tsx:270`). O token não é removido no logout (só existe upsert, `presenceClient.ts:134-136`). |
| **Estados vazios úteis** | **Parcial** | Há vazios bons: sem vínculos (`CareScreen.tsx:140`), `CareGate` (`CareStates.tsx:100-121`), alertas (`CareAlertsScreen.tsx:75-85`), histórico (`CareAuditScreen.tsx:46-55`) e dados (`CareDataScreen.tsx:105-108`). Faltam: o status do convite pendente (o cuidador não vê se o código foi aceito ou expirou, nem lista ou cancela convites); um vazio com orientação para "sem leituras" (o que fazer); e um vazio para notas e check-ins passados. |

### Outras lacunas e bugs encontrados
1. **Check-ins e compromissos nunca chegam à pessoa.** Não há tela, notificação nem resposta do lado dela. `status` fica sempre `scheduled` e `response` nunca é preenchido (busca por `care_checkins` e `scheduled_for` no app: só aparece em `AgendaScreen.tsx` e `careClient.ts`). O texto "Um convite para conversar" (`AgendaScreen.tsx:152`) promete algo que não acontece.
2. **O plano não é visível para a pessoa.** A UI diz "O plano fica disponível para a pessoa acompanhada" (`CarePlanScreen.tsx:191`), mas não há tela para ela. `emergency_contacts` nunca é editável (`CarePlanScreen.tsx:132`). Equipe: sem contato, sem `can_receive_alerts` (sempre `false`, `:168`) e sem remover.
3. **Carinho durante a pausa falha.** `PausedCard` diz "Você ainda pode mandar um carinho" (`CarePresence.tsx:356`) e `CareScreen.tsx:150` mostra o `GestureCard`. Só que a policy `care_gestures_send` exige `care_link_for`, que devolve null durante a pausa (`presence.sql:25`, `:280-284`), então o insert é recusado.
4. **"Preciso de você" durante a pausa some.** O insert é aceito (`presence.sql:322-327`), mas o cuidador pausado não consegue ler (`:328-330`) e a Edge Function filtra os pausados (`care-push/index.ts:46-48`). A pessoa recebe "Seu cuidador vai saber" (`CaredPresence.tsx:40`). **Risco de segurança emocional.**
5. **Pedido de contato não tem vínculo.** O primeiro cuidador que marca "Vi" esconde o pedido de todos (`presenceClient.ts:100-118`). A pessoa nunca vê que foi atendida, embora o texto diga "marque aqui para ela saber" (`CarePresence.tsx:135-137`). Erros de carregamento são engolidos e viram lista vazia (`presenceClient.ts:108`).
6. **Agenda:** a data é digitada como texto `AAAA-MM-DD HH:mm` (`AgendaScreen.tsx:155-165`). Não dá para editar nem cancelar. `ends_at` e `notes` nunca são gravados. Não há histórico de check-ins passados.
7. **Ações de apoio** são gravadas (`CareAlertsScreen.tsx:45`), mas nunca exibidas (`listSupportActions` não é usado).
8. **Nome da pessoa:** o convite criado em Recursos vai sem nome (`careClient.ts:108`), a pessoa vira "Pessoa acompanhada N" e não há como renomear.
9. **Espelho incompleto:** "Exatamente o painel do seu cuidador" (`CareMirrorScreen.tsx:32`), mas o cuidador também vê o `detail` dos alertas, o relatório de 30 dias com origens, a agenda, o plano, a equipe e o histórico. Com 2 cuidadores, os alertas aparecem duplicados.
10. **Card "Encerrar acompanhamento"** aparece no topo do painel, antes dos dados (`CareScreen.tsx:149`): ação destrutiva em lugar de destaque.
11. **Bem-estar do cuidador:** o sentimento não é salvo (`CarePresence.tsx:261`). `usePanelOpens` conta montagens do componente, não aberturas reais (`:240-254`).
12. **Polling** de 60 s em vez de Realtime. As migrations de Realtime foram removidas (`202608280010_remove_unhardened_care_realtime.sql`).
13. A tabela base `caregiver_links` não está versionada nas migrations, então o ambiente não se reproduz do zero.

### TODO / mock
Não há `TODO`, `FIXME` nem dados mockados no código de cuidado (busca em `app/src/care`, `Care*.tsx`, `AgendaScreen`, `supabase`, `api/routers/care.py`). O único "conteúdo fixo" são as respostas prontas do copiloto quando não há IA (`app/src/data/caregiverContent.ts:19-40`) e o guia estático.

---

## 5. Riscos de privacidade / LGPD

1. **Consentimento pouco informado** (art. 8º e art. 11, dado sensível de saúde): a pessoa aceita um código sem ver antes o que será compartilhado. O aviso "acesso integral" só aparece depois (`SettingsScreen.tsx:569`). Não há registro versionado do termo aceito: a `caregiver_consents` foi abandonada (`202608290011:98-102`). Não há escopos, então o acesso é tudo ou nada.
2. **Dado emocional inferido por câmera = dado sensível.** A RPC entrega emoção dominante **por hora** por até 90 dias, e a origem `background_vision` (`presence.sql:87-96`, `:114-116`). Mesmo sem uso na UI, qualquer cuidador consegue isso chamando a RPC direto. Isso revela a rotina (sono, horários) e fere a minimização (art. 6º, III). `evidence.latest_emotion` também vai para o cliente (`careClient.ts:201`).
3. **Widget na tela inicial** mostra o nome da pessoa, o estado e o **título e detalhe do alerta** (`CareScreen.tsx:123-130`, `widgetBridge.ts:111-128`). Isso contradiz a política de push com texto neutro (`care-push/index.ts:4-5`) e fica visível a terceiros.
4. **Compartilhar resumo** (`CareDataScreen.tsx:38-45`) manda nome, emoção predominante e insight por qualquer app do sistema, sem aviso à pessoa acompanhada e sem registro na auditoria.
5. **Copiloto de IA:** o texto livre do cuidador (que pode trazer nome, saúde ou fatos de terceiros) vai para Gemini, Anthropic ou OpenAI (`api/services/ai_service.py:289-293`) sem aviso nem consentimento da pessoa acompanhada, o que é **transferência internacional** (art. 33). Sem autenticação configurada, `ai_user` devolve `None` e a rota fica aberta (`api/utils/auth.py:73-74`).
6. **Auditoria visível entre cuidadores:** a RLS libera `actor_user_id` e `metadata` de todos os cuidadores da mesma pessoa (`foundation.sql:580-582`). A projeção mínima é só convenção do cliente (`careClient.ts:368-382`).
7. **Plano e equipe compartilhados entre cuidadores** (`care_plans` com uma linha por pessoa): o cuidador A sobrescreve o que B escreveu, e B vê dados da equipe que A cadastrou (nomes de terapeutas etc.) sem a pessoa ter decidido isso.
8. **Retenção e eliminação** (art. 16 e art. 18): a revogação mantém tudo (notas, check-ins, alertas, auditoria) para sempre. O DELETE do vínculo foi revogado (`review_hardening.sql:36-38`). Não há opção para a pessoa apagar ou exportar os dados de cuidado. As notas do cuidador sobre ela ficam guardadas em texto puro e ninguém consegue acessá-las.
9. **Transparência:** a pessoa não vê check-ins, compromissos, plano, equipe nem histórico sobre ela (sem UI), apesar de a RLS permitir. O espelho afirma "exatamente" e não é (seção 4, item 9).
10. **Push tokens** não são apagados no logout. Em aparelho compartilhado, os avisos continuam chegando (`presenceClient.ts:134-136`).
11. **Integridade:** a pessoa acompanhada pode reconhecer e resolver alertas pela API (policy `review_hardening.sql:24-34`), silenciando o cuidador. A policy de ack de `care_requests` só valida `acknowledged_by` e permite mudar `urgency` (`presence.sql:332-334`).
12. **Falha de segurança emocional** (não é LGPD, mas é risco crítico): "Preciso de você" durante a pausa não chega a ninguém (seção 4, item 4).

---

## Resumo
- O módulo é real, com Supabase, RLS e RPCs, e não tem mocks. O modelo é um vínculo único de "acesso integral" (os escopos estão mortos), com convite do cuidador, aceite, pausa de 24 h/7 dias e revogação.
- O cuidador já tem: painel, alertas com retorno, dados de 24h/7d/30d, agenda, plano, equipe, notas privadas, histórico operacional, carinho, pedidos de contato e copiloto de IA.
- **Painel multi-pessoa: parcial.** Só a pessoa selecionada carrega dados.
- **Histórico com gráficos: parcial.** A aba de 30 dias mostra só 14, não há gráfico por hora e os dias são agrupados em UTC.
- **Regras de alerta configuráveis: não existem.** Há um único gatilho fixo.
- **Insight semanal por IA: parcial.** O resumo é por regras, e a IA só existe no chat.
- **Notas: parcial.** Existem por pessoa, mas não por dia, só as 4 últimas aparecem e não dá para editar.
- **Configurações de notificação: não existem.**
- **Estados vazios: parcial.** Falta, por exemplo, o status do convite pendente.
- **Bugs que quebram fluxo:** check-ins, compromissos e plano não chegam à pessoa; o carinho falha durante a pausa; "Preciso de você" durante a pausa some; a Settings da pessoa só gerencia o primeiro cuidador.
- **Riscos LGPD principais:**
  - consentimento sem aviso prévio nem registro de termo;
  - RPC entrega emoção por hora e a origem da leitura;
  - widget expõe título e detalhe do alerta;
  - copiloto manda texto livre para IA estrangeira;
  - não há eliminação de dados após a revogação.
