# Problemas da API e do Supabase do cuidador (auditoria do Agente F)

Branch `feat/cuidador-ux-navegacao`, 2026-10-30. Escopo: `POST /api/v1/care/chat` e a pilha real do
`api/main.py` (CORS, GZip, tamanho, rate limit por IP, X-API-Key, headers de segurança, JWT e cota por
usuário), além de uma revisão de leitura das migrations de cuidado no Supabase. Nenhum código de
produção foi alterado. Não houve chamada à API de produção nem a provedores de IA reais: tudo foi
feito com mock/monkeypatch.

Testes novos: `api/tests/test_care_api_audit.py`. Cada bug confirmado tem um teste
`xfail(strict=True)` com `reason="BUG: ..."`. Quando o bug for corrigido, o teste passa a dar XPASS e
a suíte falha até alguém tirar a marcação.

## Resultado do pytest

```
cd api && venv/Scripts/python.exe -m pytest
172 passed, 10 xfailed
```

- Arquivo novo sozinho: **78 passed, 10 xfailed**.
- Antes desta auditoria a suíte tinha 94 testes, todos passando. Nenhum deles foi alterado.

## Resumo

| # | Severidade | Onde | Problema | Teste |
|---|---|---|---|---|
| A1 | Crítico | `api/services/crisis.py:16-25`, `api/routers/care.py:93` | Crise contada em 3ª pessoa não dispara | xfail (5 casos) |
| A2 | Alto | `api/routers/care.py:19,50` e `app/src/screens/ChatScreen.tsx:86` | `top_emotion="unknown"` vindo do app dá 422 e o copiloto desliga sem avisar | xfail |
| A3 | Médio | `api/routers/care.py:93` | Crise no histórico recente vai para o modelo | xfail |
| S1 | Médio | `supabase/migrations/202610280001_review_hardening.sql:76-88` | O limite de tentativas do `accept_invite` não conta as tentativas que falham | revisão |
| S2 | Médio | `supabase/migrations/202610280002_caregiver_presence.sql:286-287` | Gestos continuam legíveis pelo cuidador com o compartilhamento pausado ou revogado (`seen_at` revela atividade) | revisão |
| S3 | Médio | `supabase/migrations/202610280002_caregiver_presence.sql:332-334` | O cuidador pode reescrever qualquer coluna de `care_requests` | revisão |
| A4 | Baixo | `api/routers/care.py:101-103` | Resposta da IA só com espaços vira `response: ""` e o app mostra um balão vazio | xfail |
| A5 | Baixo | `api/main.py:167` | O 500 sai sem os headers de segurança | xfail |
| A6 | Baixo | `api/main.py:103` | O CORS não aceita `Authorization`, então o preflight do build web falha | xfail |
| S4 | Baixo | `supabase/migrations/202608280001_caregiver_foundation.sql:598` | Na política de INSERT, o cuidador escolhe `expires_at` livremente e pode pular as 72 h | revisão |
| S5 | Baixo | `supabase/migrations/202610280002_caregiver_presence.sql:75` | Armadilha de NULL em `if not care_scope_enabled(...)` | revisão |
| S6 | Baixo | `supabase/migrations/202610280002_caregiver_presence.sql:55-56` | `pause_care_sharing(link, NULL)` retoma o compartilhamento sem aviso | revisão |
| S7 | Baixo | `supabase/migrations/202610280002_caregiver_presence.sql:29-45` | `p_scope` é ignorado: o consentimento é tudo ou nada | revisão |
| S8 | Baixo | `supabase/migrations/202610280002_caregiver_presence.sql:168-176` | Leituras feitas durante a pausa contam para um alerta logo depois que ela acaba | revisão |
| S9 | Baixo | `supabase/migrations/202610280001_review_hardening.sql:182,218-219` | `vision_fairness_report` fica aberto a qualquer usuário autenticado | revisão |
| S10 | Baixo | `supabase/functions/care-push/index.ts:40-48` | O push de pedidos ignora `expires_at`, e um token de push pode ficar ligado a dois usuários | revisão |

---

## API (`POST /api/v1/care/chat`)

### A1. Crítico: crise em 3ª pessoa não dispara a resposta fixa

`api/services/crisis.py:16-25`, chamado em `api/routers/care.py:93`.

Os padrões foram escritos para quem fala de si mesmo: "me matar", "não quero mais viver", "ninguém ia
sentir **minha** falta", "me cortar". Quem usa o copiloto, porém, fala de outra pessoa. "meu filho
falou em se matar", "ele disse que vai se matar", "minha mãe disse que não quer mais viver", "ele
anda se cortando" e "ninguém ia sentir a falta dela" passam direto para o LLM. O produto promete que
risco à vida recebe sempre o texto fixo com 192/188 e nunca texto gerado. No copiloto, essa promessa
falha justamente nas frases mais prováveis. A regra 5 do prompt ajuda, mas não substitui a
verificação.

Correção sugerida: um conjunto de padrões para o cuidador (`se matar`, `se mata`, `se cortar`,
`se machucar`, `nao quer mais viver`, `tirar a propria vida`, `falta dele/dela`) usado em `care.py`.
O mesmo vale para `app/src/chat/crisis.ts`.

Teste: `test_care_crise_em_terceira_pessoa_precisa_disparar` (xfail, 5 casos). As frases em 1ª pessoa
e as que já casam ("quer morrer", "suicídio", "tomar todos os remédios") estão cobertas em
`test_care_crise_resposta_fixa_sem_modelo` e passam.

### A2. Alto: `top_emotion="unknown"` dá 422 e o copiloto desliga sem avisar

`api/routers/care.py:19` e `:50` (`KnownEmotion` com 7 valores). Do lado do app:
`app/src/screens/ChatScreen.tsx:86` e `app/src/care/presenceClient.ts:157`.

O app manda como `top_emotion` a emoção mais frequente da `distribution` de `care_dashboard_summary`.
Essa RPC não filtra `unknown`, que é um valor válido em `app/src/data/emotions.ts:9`. Basta a câmera
não reconhecer o rosto na maior parte do tempo para a API responder 422. O `catch` em
`ChatScreen.tsx:111` então troca a resposta pelas respostas prontas sem dizer nada a ninguém. Pelo
mesmo caminho, qualquer emoção que o modelo de visão ganhe no futuro também derruba o copiloto.

Correção sugerida: aceitar `unknown` (e descrevê-lo como "sem leitura clara") ou fazer o app mandar a
emoção conhecida mais frequente. Teste: `test_care_top_emotion_unknown_vinda_do_resumo_real_e_aceita`.

### A3. Médio: crise no histórico recente vai para o modelo

`api/routers/care.py:93` verifica só `request.message`. O `/chat` usa `ChatRequest.crisis_text()`
(`api/routers/ai_chat.py:62-66`), que junta os últimos turnos do usuário. Um exemplo: o cuidador
escreve "meu filho disse que quer morrer", recebe o texto fixo e em seguida pergunta "e o que eu falo
agora?". Essa segunda pergunta vai ao LLM com a crise no contexto. Teste:
`test_care_crise_no_historico_recente_tambem_da_resposta_fixa`.

### A4. Baixo: resposta só com espaços vira balão vazio

`api/routers/care.py:101-103`: o `if not text` roda antes do `.strip()`. Se o provedor devolve
`"\n "`, a API responde `{"response": "", ...}`. No app, `answer ?? caregiverReply(text)`
(`ChatScreen.tsx:111`) não troca string vazia, e aparece um balão em branco. O `_complete` em
`api/services/ai_service.py:343` também aceita texto só com espaços. Teste:
`test_care_resposta_so_com_espacos_vira_fallback`.

### A5. Baixo: o 500 sai sem os headers de segurança

`api/main.py:167`: o `@app.exception_handler(Exception)` é instalado no `ServerErrorMiddleware`, que
fica por fora de todos os `add_middleware`. Por isso o 500 genérico sai sem `nosniff`,
`X-Frame-Options` e `Referrer-Policy`, e em produção também sem HSTS. O corpo está correto e não vaza
detalhe. Os casos 401, 413, 422 e 429 levam os headers, e os testes confirmam. Teste:
`test_care_erro_interno_500_leva_headers_de_seguranca`.

### A6. Baixo: o CORS não aceita `Authorization`

`api/main.py:103`: `allow_headers=["Content-Type", "X-API-Key"]`. Com JWT ligado, o build web
(`expo start --web`) manda `Authorization` e recebe 400 no preflight. O app nativo não faz preflight,
então não é afetado. Teste: `test_cors_preflight_aceita_authorization`.

### O que está correto (coberto pelos testes, sem bug)

- **API key:** ausente, vazia, errada, com espaço no fim ou em maiúsculas dá 401 sem vazar a chave e
  com os headers de segurança. Um JWT válido sem a chave continua dando 401.
- **JWT:** ausente, lixo, assinatura errada, expirado, `aud` errado, sem `sub`, `sub` vazio,
  `alg=none` ou sem o prefixo `Bearer` dá 401. Com o JWKS fora do ar a resposta é 401, não 500.
- **Cota por usuário:** 200, 200 e depois 429 com headers, sem afetar outro usuário. A cota é
  **compartilhada** entre `/chat` e `/care/chat`. É um comportamento consciente, mas vale lembrar que
  quem conversa com o Mellow gasta a cota do copiloto.
- **Validação:** 29 payloads inválidos (extra, tipos, faixas, `history` com 9 itens, role
  `system`/`bot`, conteúdo vazio ou com mais de 2000 caracteres, `events_list` individual, corpo
  lista/string) e 8 JSON malformados (NaN, ±Infinity, truncado, vazio, `null`) dão 422 sem eco do
  input, com headers e **sem chamar a IA**. Content-Type `text/plain` dá 422 e `Content-Length`
  inválido dá 400.
- **Limites:** corpo acima do limite dá 413 com headers. `history` com 8×2000 caracteres e mensagem
  de 2000 caracteres é aceito, e só os 8 turnos mais a mensagem chegam ao modelo.
- **Prompt:** chaves de `str.format` (`{summary}`, `{0}`) no texto não quebram o prompt nem entram no
  system. Com `events=0`, score e emoção enviados junto não vazam para o prompt.
- **Sem IA:** exceção do provedor, `None`, `""`, timeout ou todos fora dão `{"response": null,
  "provider": "fallback"}`. A cadeia passa para o próximo provedor e faz `strip`.
- **Erros:** o 500 devolve `{"error": "Internal server error"}` sem caminho nem detalhe. GET na rota
  dá 405 com headers e uma subrota inexistente dá 404.

---

## Supabase (revisão de leitura, sem Postgres local)

Arquivos: `202610280001_review_hardening.sql`, `202610280002_caregiver_presence.sql`,
`202608290011_caregiver_full_link_access.sql`, `202608280006_caregiver_link_revocation.sql`,
`202608280001_caregiver_foundation.sql` e `supabase/functions/care-push/index.ts`.

### Verificações pedidas

- **Cuidador vendo dado de quem não consentiu:** não encontrei caminho. `emotion_events` só é
  legível pelo dono (`foundation.sql:588`). O cuidador só lê agregados por
  `care_dashboard_summary`, que exige um vínculo aceito, não revogado, não expirado e não pausado.
  `caregiver_links` não tem política de UPDATE (o cuidador não consegue tirar `paused_until`) e não
  tem mais DELETE.
- **Pausa/revogação que não corta acesso:** `care_link_for` e `care_scope_enabled` (presence.sql:14-45)
  cortam alertas, check-ins, agenda, plano, equipe, notas, ações, auditoria, `care_requests` e o
  resumo. **A exceção é `care_gestures`** (S2).
- **RPC security definer sem `auth.uid()`:** `accept_invite`, `revoke_care_link` e `create/join_care_group`
  verificam explicitamente. `pause_care_sharing`, `give_alert_feedback` e `care_dashboard_summary`
  verificam de forma implícita: o `WHERE cared_user_id = auth.uid()`, o `care_link_for` e o
  `care_scope_enabled` falham fechados com usuário anônimo, e o EXECUTE foi revogado de `anon`. Há uma
  ressalva de NULL em S5.
- **search_path:** todas as funções security definer de cuidado usam `pg_catalog` ou `''` com nomes
  qualificados. As versões antigas com `search_path = public` (`202610220003/0004`) foram substituídas
  em `review_hardening.sql`. Nada faltando.

### S1. Médio: o limite de tentativas do `accept_invite` não conta as falhas

`202610280001_review_hardening.sql:82` grava a tentativa em `private.invite_attempts`, e
`:85-89` dá `raise exception` quando o código não existe, já foi usado ou expirou. Um erro não
tratado em PL/pgSQL desfaz toda a chamada RPC, **incluindo o INSERT da tentativa**. Na prática, só os
aceites bem-sucedidos são contados, e o limite de "10 por hora" nunca segura quem chuta códigos. A
entropia do código (10 símbolos, cerca de 50 bits, `app/src/care/careClient.ts:55-59`) junto com a
validade de 72 h reduz o risco real. Mesmo assim, o controle documentado não funciona.

Correção: devolver erro sem `raise` (função que retorna status ou NULL), ou registrar a tentativa
num bloco `BEGIN ... EXCEPTION` que não desfaz o INSERT.

### S2. Médio: gestos continuam visíveis com o compartilhamento pausado ou revogado

`202610280002_caregiver_presence.sql:286-287`: `care_gestures_read` libera
`caregiver_user_id = auth.uid()` sem passar por `care_link_for`. Durante a pausa e depois da revogação,
o cuidador continua lendo os gestos que mandou, **incluindo `seen_at`**, que a pessoa atualiza ao
abrir o app (`:289-291`). Isso funciona como um sinal de presença ("ela abriu o app às 23h"),
exatamente o que a pausa deveria esconder.

Correção: na leitura do cuidador, exigir `care_link_for(cared_user_id) = caregiver_link_id`, ou
esconder `seen_at` com uma view ou com GRANT por coluna.

### S3. Médio: o cuidador pode reescrever qualquer coluna de `care_requests`

`202610280002_caregiver_presence.sql:332-334`: a política de UPDATE só exige um vínculo ativo e
`acknowledged_by = auth.uid()`. O cuidador consegue mudar `urgency` (rebaixar um "agora" para os
outros cuidadores), `created_at` (driblar o limite de 5 por hora em `:339-341`) e até `cared_user_id`
para outra pessoa que ele acompanhe. Também pode sobrescrever o `acknowledged_by` de outro cuidador.

Correção: `grant update (acknowledged_at, acknowledged_by)` em vez de UPDATE na tabela inteira, e um
gatilho de imutabilidade igual ao de `care_alerts`. O mesmo GRANT por coluna serve para
`care_gestures` (`:277`, a pessoa acompanhada consegue alterar `kind`/`caregiver_link_id`).

### S4. Baixo: o cuidador pode estender a validade do convite

`202608280001_caregiver_foundation.sql:598` (`caregiver_links_insert_as_caregiver`) não limita
`expires_at`, e o gatilho de `review_hardening.sql:41-53` só preenche o valor quando ele vem nulo. Um
cliente pode inserir um convite com `expires_at` em 2100 e pular as 72 h. Correção: forçar
`new.expires_at := least(coalesce(new.expires_at, ...), now() + interval '72 hours')` e recusar
`paused_until`/`revoked_at` no INSERT.

### S5. Baixo: armadilha de NULL em `care_dashboard_summary`

`202610280002_caregiver_presence.sql:75`: com `p_cared_user_id` nulo (ou `auth.uid()` nulo),
`care_scope_enabled` retorna NULL. `if not NULL` não entra no `raise`, e a função segue sem erro.
Hoje isso devolve um resumo vazio porque o filtro `user_id = NULL` não casa nada, mas o portão está
aberto. Correção: `if coalesce(private.care_scope_enabled(...), false) is not true then raise`.

### S6. Baixo: `pause_care_sharing(link, NULL)` retoma o compartilhamento sem aviso

`202610280002_caregiver_presence.sql:55-56`: `NULL not in (0,24,168)` é NULL e passa pela
verificação. `make_interval(hours => NULL)` também é NULL, e o resultado é **retomar** o
compartilhamento. Um bug no app que mande `p_hours` indefinido desfaz a pausa calado. Correção:
`if p_hours is null or p_hours not in (...)`.

### S7. Baixo (informativo): o consentimento é tudo ou nada

`202610280002_caregiver_presence.sql:29-45`: `care_scope_enabled(p_cared_user_id, p_scope)` ignora
`p_scope`. Isso foi decidido em `202608290011` ("vínculo aceito libera todo o módulo"), mas as
políticas continuam passando `'alerts'`, `'trends'`, `'checkins'` e assim por diante, o que faz
parecer que existe consentimento por área. Fica documentado para ninguém achar que existe controle
granular. Se o produto prometer "escolha o que compartilhar", isso vira Alto.

### S8. Baixo: leituras feitas durante a pausa geram alerta logo depois que ela acaba

`202610280002_caregiver_presence.sql:168-176`: a janela de 90/120 min conta leituras difíceis
registradas **durante** a pausa. A primeira leitura depois que a pausa acaba pode então disparar um
alerta baseado em dados que a pessoa pediu para não compartilhar. Correção: contar só
`created_at > coalesce(l.paused_until, '-infinity')`.

### S9. Baixo: `vision_fairness_report` aberto a qualquer usuário autenticado

`202610280001_review_hardening.sql:182` e `:218-219`: com k = 10 e contas de 30+ dias o risco de
reidentificação é baixo, mas é um relatório de auditoria interna. Restringir a `service_role` ou a um
papel de administrador.

### S10. Baixo: push (`supabase/functions/care-push/index.ts`)

- `:40-48`: o push de `care_requests` e `care_alerts` filtra `paused_until` e `revoked_at`, mas não
  `expires_at` (as funções SQL filtram).
- `push_tokens` (`presence.sql:350-356`) usa a chave `(user_id, token)`. Num aparelho compartilhado,
  o mesmo token fica ligado a duas contas e o aviso de uma chega para a outra. O texto é neutro, então
  o impacto é baixo. Correção: `token` único e upsert por token.
