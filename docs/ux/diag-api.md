# Diagnóstico de backend/API para o modo cuidador (Agente C)

Branch `feat/cuidador-ux-navegacao`, commit `5371f56`. Só leitura. Nenhum código foi alterado.

**Correção do briefing:** não existe SQLite, DeepFace nem Anthropic como base. A API é FastAPI (`api/`), publicada no Render (https://mellowpet.onrender.com). IA via Gemini por padrão, com Anthropic e OpenAI apenas como fallback opcional (`api/config.py:67-70`). Os dados do usuário e do cuidador **não passam pela API**: o app fala direto com o Supabase (Postgres + RLS + RPCs), como diz `api/main.py:50-52`. O arquivo `api/mellowpet.db` é resto de uma versão antiga e não é importado em lugar nenhum.

---

## 1. Endpoints FastAPI

### Controles globais (todas as rotas)

| Controle | Onde | Comportamento |
|---|---|---|
| API key (`X-API-Key`) | `api/utils/security.py:172-197`, registrado em `api/main.py:87` | Exigida fora de `public_paths` = `/health`, `/`, `/docs`, `/openapi.json`, `/redoc` (`api/config.py:49`). Sem `API_KEY` deixa passar, mas em produção o boot falha (`api/config.py:107-116`). A chave vai embutida no APK, então serve só contra abuso casual (`api/config.py:42-45`). |
| Rate limit por IP | `api/utils/security.py:122-169`, `api/main.py:88` | 120 req/min por IP, janela deslizante em memória (`api/config.py:52`). `/health` fica isento. Responde 429 com `Retry-After`. Por processo: com várias réplicas, o limite efetivo se multiplica (`security.py:10-13`). |
| Limite de corpo | `api/utils/security.py:48-119` | 6 MB (`api/config.py:53`), inclusive em requisição chunked. |
| JWT do Supabase (opcional) | `api/utils/auth.py:71-88` (dependência `ai_user`) | Só nas rotas de IA. Fica ativo quando `SUPABASE_JWT_SECRET` (HS256) ou `SUPABASE_URL` (JWKS ES256/RS256) estão configurados (`auth.py:31-43`). Exige `Authorization: Bearer`, valida `aud=authenticated` e limita 20 req/min **por usuário** (`config.py:79`). Sem essas variáveis, devolve `None` e não exige nada. |
| CORS | `api/main.py:95-105` | `allow_headers=["Content-Type","X-API-Key"]`. **`Authorization` não está na lista**: um cliente web com preflight seria barrado ao mandar o JWT. Hoje não afeta o app mobile. |
| Erros | `api/main.py:152-184` | 422 devolve só os nomes dos campos, sem ecoar o input. 500 vem genérico. |

### Rotas

| Método | Rota | Auth | Request (Pydantic) | Response | Arquivo:linha |
|---|---|---|---|---|---|
| GET | `/health` | pública, sem rate limit | — | `{status, service, version, env, timestamp}` | `api/main.py:131` |
| GET | `/` | pública | — | `{message, docs, health}` | `api/main.py:142` |
| POST | `/api/v1/chat/` | API key + `ai_user` (JWT opcional) | `ChatRequest{message ≤4000, emotion: KnownEmotion+unknown, confidence 0..1, history: ChatMessage[≤12], memory: str[≤8, ≤160]}` (`ai_chat.py:44-66`) | `ChatResponse{response, emotion_context, provider, action?}` (`ai_chat.py:69-73`) | `api/routers/ai_chat.py:76` |
| POST | `/api/v1/chat/stream` | idem | `ChatRequest` | SSE: `data:{delta}` repetido, depois `data:{done, provider, action}` | `api/routers/ai_chat.py:99` |
| POST | `/api/v1/dashboard/insight` | idem | `InsightRequest{summary: InsightSummary{dominant, distribution ≤8 (0..100, soma ≤103.5), wellbeing_score 0..100, total_readings}, period: "24 horas"\|"3 dias"\|"7 dias"}` (`dashboard.py:24-53`) | `{insight, provider}` | `api/routers/dashboard.py:56` |
| POST | `/api/v1/pet/dream` | idem | `DreamRequest{pet_name (regex), dominant?, fed, played, breaths, friends[≤3]}` (`pet.py:37-45`) | `{dream \| null, provider}` | `api/routers/pet.py:48` |
| POST | `/api/v1/care/chat` | idem | `CareChatRequest{message ≤2000, history: CareTurn[≤8], summary?: CareSummary{period: "24 horas"\|"7 dias"\|"30 dias", events, score 0..100?, top_emotion?, difficult_share 0..1, relationship?}}` (`care.py:44-74`) | `{response \| null, provider}`. Crise no texto devolve resposta fixa com 192/188 (`care.py:93-94`). | `api/routers/care.py:91` |
| GET | `/api/v1/tools/recommendations` | só API key | query `emotion`, `confidence 0..1`, `face_detected` | `ToolsResponse` | `api/routers/tools.py:1173` |
| GET | `/api/v1/tools/daily-content` | só API key | `emotion` | `DailyContentResponse` | `tools.py:1187` |
| GET | `/api/v1/tools/breathing-protocol` | só API key | `emotion`, `confidence` | `BreathingProtocolResponse` | `tools.py:1193` |
| GET | `/api/v1/tools/meditation` | só API key | `emotion`, `duration 3..30` | `MeditationSession` | `tools.py:1202` |
| GET | `/api/v1/tools/{grounding, journal-prompts, cognitive-reframing, muscle-relaxation, sleep-hygiene, emotion-education, gratitude, social-connection, energy-boost, focus-mode, playlist, visualization, affirmations, emotion-wheel}` | só API key | `emotion` | modelo homônimo (`tools.py:17-195`) | `tools.py:1211-1281, 1509-1522` |
| GET | `/api/v1/tools/crisis-resources` | só API key | `emotion`, `confidence` | `CrisisResources` | `tools.py:1259` |
| GET | `/api/v1/tools/body-scan` | só API key | `emotion`, `duration 3..15` | `BodyScan` | `tools.py:1500` |

O conteúdo de `tools` é estático, sem banco e sem IA. A cadeia de IA e os fallbacks ficam em `api/services/ai_service.py:296-519`: timeout de 25 s (`config.py:71`), queda automática para o próximo provedor (`ai_service.py:339-350`) e respostas offline (`ai_service.py:507-519`).

**Ponto para o modo cuidador:** a única rota que serve o cuidador é `POST /api/v1/care/chat`. Ela recebe **só o agregado que o app já calculou**. A API não lê nada do Supabase e não confere se quem chama tem vínculo com a pessoa. O `summary` vem do cliente, sem verificação.

---

## 2. O que o Supabase expõe para o cuidador

> O schema base (`caregiver_links`, `emotion_events`, `profiles`, `user_settings`, `journal_entries`, `routine_items`) **não está versionado** no repositório. As migrations só o alteram (`supabase/README.md:6-21`). As colunas conhecidas vêm do uso no app: `caregiver_links{id, invite_code, caregiver_user_id, cared_user_id, cared_name, relationship, status 'pending'|'accepted', accepted_at, created_at}` (`app/src/care/careClient.ts:19-31`) e `emotion_events{event_id, user_id, emotion, confidence, all_scores, face_detected, source, created_at}` (`app/src/vision/manualEmotion.ts:21-31`).

### Helpers de autorização (schema `private`)

| Função | Versão vigente | O que checa |
|---|---|---|
| `private.care_link_for(p_cared_user_id uuid) → uuid` | `202610280002_caregiver_presence.sql:14-27` | Devolve o id do vínculo do `auth.uid()` (cuidador) com a pessoa quando `status='accepted'`, `revoked_at is null`, não expirado **e não pausado** (`paused_until is null or <= now()`). Caso contrário, `NULL`. |
| `private.care_scope_enabled(p_cared_user_id, p_scope) → bool` | `202610280002_caregiver_presence.sql:29-45` | `true` se `auth.uid()` é a própria pessoa, ou se existe um vínculo ativo e não pausado. **O `p_scope` é ignorado** desde `202608290011_caregiver_full_link_access.sql:22-39`: o vínculo aceito libera tudo (comentário em `:104-105`). |

### RPCs

| RPC | Assinatura / retorno | Arquivo:linha (versão vigente) | Regras |
|---|---|---|---|
| `care_dashboard_summary` | `(p_cared_user_id uuid, p_hours int default 168) → jsonb {events, last_event_at, mean_confidence (0-100), distribution[{emotion,count}], hourly[{at,count,dominant}], daily[{at,count,dominant,pleasant,neutral,difficult}], sources[{source,count}]}` | `202610280002_caregiver_presence.sql:67-129` | `security definer`. Exige `care_scope_enabled(...,'trends')`; se falhar, `raise 'care_scope_denied'` (42501) em `:75-77`. `p_hours` fica entre 1 e 2160 (90 dias) em `:72`. A agregação é feita na hora sobre `emotion_events`. É a **única** leitura emocional do cuidador. |
| `accept_invite` | `(code text) → caregiver_links` | `202610280001_review_hardening.sql:61-97` | No máximo 10 tentativas/h por pessoa (`:76-82`). Erros: `invite_not_found` P0002, `invite_already_accepted` 23505, `invite_revoked` / `invite_expired` / `cannot_accept_own_invite` 22023, `too_many_attempts` 54000. Grava `cared_user_id=auth.uid()`, `status='accepted'` e `expires_at=null` (`:91-94`). O convite expira em 72 h (trigger em `:41-53`). |
| `revoke_care_link` | `(p_link_id uuid) → void` | `202608280006_caregiver_link_revocation.sql:3-44` | Qualquer uma das partes pode chamar. Grava `revoked_at=now()` e marca o consentimento legado como `revoked`. É idempotente. |
| `pause_care_sharing` | `(p_link uuid, p_hours int) → timestamptz` (o `paused_until` novo, ou `null`) | `202610280002_caregiver_presence.sql:48-64` | Só a pessoa acompanhada chama (`cared_user_id = auth.uid()`). `p_hours ∈ {0, 24, 168}`; 0 retoma. Erros `invalid_pause` 22023 e `link_not_found` P0002. |
| `give_alert_feedback` | `(p_alert uuid, p_feedback text) → void` | `202610280002_caregiver_presence.sql:247-262` | `p_feedback ∈ {useful, false_alarm, already_knew}`. Só o cuidador **daquele** vínculo (`caregiver_link_id = care_link_for(...)`). Grava `feedback` e `feedback_at`. |
| `create_care_group` / `join_care_group` | `(group_name) → (id, code)` / `(group_code) → uuid` | `202610280001_review_hardening.sql:100-137` | O coordenador não entra no próprio grupo. |
| `care_group_summary` | `(gid uuid, days int default 7) → table(members_band text, emotion text, share numeric)` | `202610280001_review_hardening.sql:139-171` | Só o dono do grupo chama. Janela fixa de 7 ou 30 dias. Conta só membros com mais de 7 dias de grupo. Exige k ≥ 5 pessoas. `share` sai arredondado a 5%. Membros aparecem por faixa (`5-9`, `10-19`, `20+`). |
| `vision_fairness_report` | `(min_users int default 10)` | `202610280001_review_hardening.sql:181-219` | Fora do escopo do cuidador. |

### Trigger de alerta

`private.create_persistent_signal_alert()` roda em `AFTER INSERT` de `emotion_events` (trigger em `202608280001_caregiver_foundation.sql:347-350`; versão vigente da função em `202610280002_caregiver_presence.sql:136-196`):

- Só dispara com emoção difícil (`sad`, `angry`, `disgusted`, `fearful`).
- Para cada vínculo ativo **e não pausado**, cria um alerta quando as N últimas leituras são difíceis. Normalmente N=3 em 90 min. Se houver 3 ou mais `false_alarm` nos últimos 30 dias e eles superarem os `useful`, N=4 em 120 min.
- Não repete se já houver alerta aberto do mesmo tipo nas últimas 6 h.
- Gera apenas um tipo: `kind='persistent_difficult_signal'`, `severity='attention'`, `evidence={readings, required, latest_emotion}`.

O push sai pela Edge Function `supabase/functions/care-push/index.ts:22-72`, acionada por Database Webhook em INSERT de `care_alerts`, `care_requests` e `care_gestures`. O texto é neutro. Na consulta (`:40-48`) ela filtra os cuidadores pausados, mas não `expires_at`.

### Tabelas que o cuidador lê ou escreve (RLS)

| Tabela | Definição | Policy vigente | Cuidador pode |
|---|---|---|---|
| `caregiver_links` | base + `revoked_at`, `expires_at`, `requested_scopes`, `updated_at` (`foundation.sql:10-14`), `paused_until` (`presence.sql:12`) | SELECT: as duas partes (`foundation.sql:596-597`). INSERT: só como cuidador, `pending`, sem `cared_user_id` (`:598-604`). DELETE foi removido (`review_hardening.sql:37-38`). | Ver os próprios vínculos, inclusive revogados e pausados, para mostrar o estado. Criar convite. |
| `care_alerts` | `foundation.sql:28-45` + `feedback`, `feedback_at` (`presence.sql:132-134`) | SELECT/UPDATE: a própria pessoa, ou `caregiver_link_id = care_link_for(cared_user_id)` (`review_hardening.sql:16-34`). Sem INSERT para `authenticated` (grant em `foundation.sql:478`). As transições `open→acknowledged→resolved` e a mudança só de feedback são validadas por trigger (`presence.sql:200-243`). | Ver e mexer **só nos alertas do próprio vínculo**. |
| `care_checkins` (agendados pelo cuidador) | `foundation.sql:51-63` | `cared_user_id = auth.uid()` ou vínculo ativo (`foundation.sql:532-541`) | CRUD sem DELETE (grant `:479`). |
| `care_appointments` | `foundation.sql:68-79` | idem (`:542-551`) | idem |
| `care_plans` (1 por pessoa) | `foundation.sql:84-93` | `care_scope_enabled` (`:552-555`) | Ler e editar. |
| `care_team_members` | `foundation.sql:95-105` | idem (`:556-559`) | Ler e editar. |
| `caregiver_notes` | `foundation.sql:107-114` | `caregiver_user_id = auth.uid()` e `care_link_for(cared_user_id) is not null` (`:560-569`) | Notas privadas: só o autor vê. Sem DELETE (grant `:483`). |
| `care_support_actions` | `foundation.sql:116-126` | vínculo ativo (`:570-579`) | Registrar ações. |
| `care_audit_log` | `foundation.sql:128-136`, triggers em `202608280004_caregiver_audit_triggers.sql:35-58` | `care_scope_enabled` (`foundation.sql:580-582`) | Ver a trilha (sem conteúdo; `metadata` só tem `record_id`). |
| `care_gestures` (carinho via pet) | `presence.sql:265-305` | INSERT: `caregiver_link_id = care_link_for(...)` (`:280-284`). SELECT: remetente ou destinatário (`:286-287`). Máximo de 6 por dia por vínculo (`:294-305`). | Mandar e ver os próprios gestos. |
| `care_requests` ("preciso de você") | `presence.sql:308-347` | INSERT: a pessoa, se tiver vínculo aceito (`:321-327`). SELECT/UPDATE (ack): `care_link_for(...) is not null` (`:328-334`). Máximo de 5 por hora (`:336-347`). | Ver e confirmar pedidos. |
| `push_tokens` | `presence.sql:350-362` | só o dono | Registrar o próprio token. |
| `caregiver_consents` | `foundation.sql:16-26` | Bloqueada: grant revogado (`full_link_access.sql:98-102`) e policy restritiva `using(false)` (`202608290012_lock_legacy_caregiver_consents.sql:3-9`) | Nada (é legado). |

**O que garante que o cuidador só vê quem consentiu:**

1. O vínculo só fica `accepted` pela RPC `accept_invite`, executada **pela pessoa acompanhada** com o código. O INSERT direto obriga `status='pending'` e `cared_user_id is null` (`foundation.sql:598-604`), então o cuidador não consegue se vincular sozinho.
2. Toda policy de dado da pessoa passa por `care_link_for` ou `care_scope_enabled`, que exigem `accepted`, não revogado, não expirado e não pausado.
3. `emotion_events` só é legível pelo dono (`foundation.sql:586-589`). O cuidador recebe apenas o agregado da RPC.
4. `checkins` (com texto, tags e sono) só são legíveis pelo dono (`202609160001_checkins.sql:35-48`). O cuidador não os vê.
5. `vision_intervals` e `vision_feedback` também só pelo dono (`202609170001_vision_telemetry.sql:42-92`).

**Nuance de produto:** o "consentimento" é binário (o vínculo). Escopo granular por tipo de dado existiu e foi desligado em `202608290011`. A pessoa não escolhe *o que* compartilhar, só *se* compartilha, se pausa ou se encerra.

---

## 3. Vínculo usuário–cuidador: representação e corte de acesso

**Representação:** uma linha em `public.caregiver_links`, que passa pelos estados abaixo.

- **pendente:** `caregiver_user_id` preenchido, `cared_user_id = null`, `status='pending'`, `expires_at = now()+72h`.
- **aceito:** `accept_invite` grava `cared_user_id`, `status='accepted'`, `accepted_at` e `expires_at=null`.
- **pausado:** `paused_until > now()`.
- **revogado:** `revoked_at` preenchido.

Um cuidador pode ter N vínculos (N pessoas), e uma pessoa pode ter N cuidadores. Não existe uma tabela de "pessoa acompanhada" separada: o nome e a relação ficam no próprio vínculo (`cared_name`, `relationship`).

**Revogação** (`revoke_care_link`, `202608280006_caregiver_link_revocation.sql:33-39`): grava `revoked_at = now()`. A partir daí `care_link_for` devolve `NULL` (`presence.sql:23`) e `care_scope_enabled` devolve `false` (`presence.sql:40`). Na prática:

- `care_dashboard_summary` levanta `care_scope_denied`.
- `care_alerts`, `care_checkins`, `care_appointments`, `care_support_actions`, `care_requests`, `care_plans`, `care_team_members` e `care_audit_log` deixam de passar no USING.
- `caregiver_notes` some também, porque a policy exige `care_link_for(...) is not null`. **O cuidador perde acesso às próprias notas** (as linhas continuam no banco).
- O trigger de alerta para de gerar alertas para o vínculo.
- Os dados ficam preservados, já que DELETE de vínculo foi proibido (`review_hardening.sql:36-38`).

O acesso é cortado na hora, porque a checagem roda em cada query. Não há cache nem token de escopo.

**Pausa** (`pause_care_sharing`): grava `paused_until`. As mesmas funções exigem `paused_until is null or <= now()` (`presence.sql:25` e `:43`), então o efeito é idêntico ao da revogação enquanto a pausa durar. Ela também:

- impede gerar alerta (`presence.sql:158`);
- tira o cuidador do push (`care-push/index.ts:47`);
- retoma sozinha quando o prazo vence, sem job (a comparação é com `now()`).

O cuidador continua vendo a linha do vínculo, com `paused_until`, para mostrar "compartilhamento pausado".

**Riscos e pontos a verificar:**

- **"Preciso de você" durante a pausa fica invisível.** `care_requests_ask` não checa pausa (`presence.sql:322-327`), mas o SELECT do cuidador exige `care_link_for`, que exclui pausados (`:329-330`), e o push também os filtra. A pessoa consegue pedir ajuda e ninguém recebe. Quando a pausa acaba, os pedidos antigos aparecem de uma vez. É uma decisão de produto que precisa ser explícita, ou o pedido deveria furar a pausa.
- O INSERT em `care_requests` também não checa `expires_at` (só `revoked_at`).
- **Não há policy de UPDATE em `caregiver_links` nas migrations.** Se o schema base (não versionado) tiver uma policy de UPDATE para as partes, o cuidador poderia zerar `paused_until` ou `revoked_at` direto. Precisa ser conferido no painel do Supabase.
- Não há testes SQL (pgTAP ou similar) para nenhuma dessas policies. Os testes do repositório são só da API Python.

---

## 4. Dados emocionais e históricos disponíveis

| Fonte | Conteúdo | Quem lê | Janela |
|---|---|---|---|
| `emotion_events` (base) | Uma linha por leitura: `emotion`, `confidence`, `source` (`mobile`/`checkin`/`widget_manual`/`background_vision`...), `created_at` | Só o dono (`foundation.sql:588-589`). O app pagina direto (`app/src/dashboard/aggregate.ts:84-100`). | Ilimitada para o dono |
| `care_dashboard_summary` | Agregado do cuidador: distribuição, série por **hora** e por **dia** (com `pleasant`/`neutral`/`difficult`), origens, confiança média, última leitura | Cuidador ativo e a própria pessoa | De 1 h a 90 dias (`p_hours`). O app usa 24 h, 7 d e 30 d (`docs/caregiver-module.md:45`; chamadas em `app/src/screens/CareDataScreen.tsx:31` e `CareScreen.tsx:66`). |
| `checkins` | Autorrelato: emoção, nota ≤280, tags, sono 1-5, leitura da câmera no instante | Só o dono | Ilimitada |
| `vision_intervals` / `vision_feedback` | Telemetria por intervalo: distribuição, qualidade, `tension_signal` | Só o dono | Ilimitada |
| `care_days` | Um registro por dia de autocuidado, com data **local** (`202610220001_care_days.sql:12-34`) | Só o dono | Ilimitada |
| `care_alerts` | Histórico de alertas com status e feedback | Cuidador (do próprio vínculo) e a pessoa | Ilimitada (sem filtro de data no app, `careClient.ts:198-207`) |
| `care_requests`, `care_gestures`, `care_support_actions`, `care_audit_log` | Histórico de interações de cuidado | Ver a seção 2 | Ilimitada |
| `care_group_summary` | Distribuição de grupo (k ≥ 5) | Dono do grupo | 7 ou 30 dias |

**Janelas suportadas para o cuidador:**

- **Dia** e **hora**: sim, como buckets da RPC.
- **Semana**: sim, como janela (`p_hours=168`), mas **sem bucket semanal**.
- **Mês**: só como janela de até 30-90 dias com buckets diários. Não há agregado mensal nem comparação mês contra mês.

**Limitações:**

- Não existe tabela de agregados diários materializada: tudo é calculado na hora sobre `emotion_events`, e 90 dias de leituras contínuas custam caro.
- `date_trunc('day', created_at)` usa o fuso da sessão, UTC por padrão no Supabase (`presence.sql:100`). O dia do cuidador no Brasil vira às 21h, ao contrário de `care_days`, que usa data local.
- Não há `score` vindo do servidor. O "índice" que vai para o copiloto (`CareSummary.score`) é montado no cliente e enviado pronto (tipo `CopilotSummary` em `app/src/care/presenceClient.ts:144-150`; envio em `:152-162`).

---

## 5. Lacunas para o que o briefing pede

| Pedido | Existe hoje | Falta no banco | Falta na API/RPC |
|---|---|---|---|
| **Anotações do cuidador por pessoa/dia** | `caregiver_notes` (`caregiver_user_id`, `cared_user_id`, `body`, `created_at`). Só o autor vê. O app lista e cria (`careClient.ts:320-338`). | Coluna `day date` (data local) com índice `(caregiver_user_id, cared_user_id, day)` para anotar *sobre* um dia e não só *num* dia. Grant e policy de DELETE (hoje não dá para apagar). Talvez tags e limite de tamanho (`body` não tem `check`). Decidir se, após revogar, o cuidador mantém leitura das próprias notas (hoje perde). | Nada na API. O CRUD é direto no Supabase. |
| **Preferências de notificação** | `push_tokens` (token por usuário). `user_settings.alerts_enabled` e `no_face_alert_minutes` são da **própria pessoa**, não do cuidador (`app/src/settings/settingsClient.ts:6-14`; tabela fora do versionamento). A Edge Function manda para todos os tokens, sem filtro (`care-push/index.ts:56-63`). | Tabela `care_notification_prefs` (por cuidador, opcionalmente por vínculo): canais, tipos (alerta / pedido / gesto), horário de silêncio, fuso, resumo vs. imediato. | A Edge Function `care-push` precisa ler e respeitar essas preferências. Hoje não há horário de silêncio nem opt-out por tipo. |
| **Regras de alerta configuráveis** | Uma regra fixa no código do trigger (3 difíceis/90 min ou 4/120 min, cooldown de 6 h, severidade fixa `attention`) com autoajuste por feedback (`presence.sql:160-166`). | Tabela `care_alert_rules` por vínculo (tipo, limiar, janela, cooldown, severidade, ativo). Quem configura: o cuidador, a pessoa ou os dois? Sem regra de ausência ("X h sem leitura") e sem alerta a partir de `care_requests` ou check-in perdido. | O trigger precisa ler a regra do vínculo. Possivelmente RPC `set_alert_rule` com validação de faixa, para impedir regras que virem vigilância (por exemplo, janela mínima). |
| **Histórico mensal** | A RPC aceita até 90 dias e devolve buckets diários. | Agregado diário materializado (`emotion_daily_agg(user_id, day_local, counts...)`) alimentado por trigger ou cron, com dia **local** (hoje é UTC). | RPC `care_history(p_cared_user_id, p_from, p_to, p_bucket 'day'\|'week'\|'month')` com o mesmo gate de `care_scope_enabled`, mais comparação de período anterior. Hoje não há bucket semanal nem mensal. |
| **Resumo semanal por IA** | `POST /api/v1/care/chat` (conversa, recebe o agregado do cliente) e `POST /api/v1/dashboard/insight` (insight do **próprio** usuário, `period` limitado a 24 h/3 d/7 d, `dashboard.py:53`). | Tabela `care_weekly_summaries(link_id, week_start, text, provider, created_at)` para guardar o texto e não pagar IA a cada abertura. Job semanal (pg_cron ou Edge Function agendada). | Endpoint novo (ex.: `POST /api/v1/care/weekly-summary`) com modelo que aceite série diária e alertas da semana. Para não confiar no agregado enviado pelo cliente, a API teria que ler o Supabase com o JWT do cuidador (chamar `care_dashboard_summary` sob RLS); hoje a API não tem cliente Supabase. Também falta `Authorization` no CORS (`main.py:103`) se houver cliente web. |

**Outras lacunas relevantes para a UX do cuidador:**

- `care_alerts` tem um único `kind`. A UI de "tipos de alerta" não tem dados para mostrar além deste.
- O dashboard atualiza por polling de 60 s (`docs/caregiver-module.md:37-39`), porque o Realtime foi removido (`202608280010_remove_unhardened_care_realtime.sql`).
- O schema base não está versionado, o que impede revisar a RLS de `caregiver_links` (UPDATE) e de `profiles` (o cuidador lê `email` e `display_name` de outros perfis em `careClient.ts:165`; a policy não está no repo).

---

## 6. Resultado atual do pytest

Comando: `api/venv/Scripts/python.exe -m pytest -q`, rodado dentro de `api/`. Para ver a linha de resumo foi usado `-o addopts=""`, porque o `-q` duplicado do `pytest.ini` esconde o resumo.

```
94 passed in 7.28s
```

São 7 arquivos em `api/tests/`: `test_api_validation` (5 funções), `test_care_copilot` (4), `test_chat_features` (7), `test_config` (7), `test_review_api` (28), `test_security` (12) e `test_user_auth` (4). Com parametrização, dão 94 casos. Nenhum teste cobre migrations, RLS ou a Edge Function.

---

## Resumo

1. A API FastAPI tem 23 rotas sob `/api/v1` mais `/health` e `/`. Todas exigem `X-API-Key` e têm limite de 120 req/min por IP. As cinco de IA (chat, chat/stream, dashboard/insight, pet/dream, care/chat) aceitam JWT do Supabase opcional, com limite de 20/min por usuário.
2. Para o cuidador, a API só tem `POST /api/v1/care/chat`. Ela não lê banco e confia no agregado mandado pelo cliente.
3. Todo dado de cuidador está no Supabase. O gate é `private.care_link_for` / `care_scope_enabled`, que exigem vínculo aceito, não revogado, não expirado e não pausado (`202610280002_caregiver_presence.sql:14-45`).
4. O consentimento é binário (o vínculo). Escopos granulares foram desligados (`202608290011`). O cuidador nunca lê `emotion_events` nem `checkins` direto, só `care_dashboard_summary`.
5. Revogar (`revoke_care_link`) e pausar (`pause_care_sharing`, 24 h ou 7 d) cortam o acesso na hora em todas as policies e no trigger de alerta. A pausa vence sozinha.
6. Risco: "preciso de você" enviado durante a pausa fica invisível para o cuidador e não gera push.
7. Risco: não existe policy de UPDATE de `caregiver_links` nas migrations, e o schema base não está versionado. Precisa conferir no painel.
8. Histórico para o cuidador: buckets por hora e por dia, janela de até 90 dias. Não há bucket semanal ou mensal nem agregado materializado, e o "dia" é calculado em UTC.
9. Alertas: uma única regra fixa no trigger, que se ajusta sozinha com o feedback, e um único `kind`.
10. Lacuna: notas existem (`caregiver_notes`), mas sem coluna de dia e sem DELETE, e somem para o autor após revogar.
11. Lacuna: não há preferências de notificação do cuidador. A Edge Function `care-push` envia para todos os tokens.
12. Lacuna: não há regras de alerta configuráveis (precisaria de uma tabela por vínculo e de o trigger lê-la).
13. Lacuna: não há histórico mensal (precisaria de agregado diário local e de RPC com bucket).
14. Lacuna: não há resumo semanal por IA (precisaria de endpoint, tabela de cache e job agendado; idealmente a API leria o Supabase sob o JWT do cuidador).
15. pytest: 94 passed em 7,28 s. Não há testes de RLS nem de migrations.
