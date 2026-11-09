# Problemas de navegação: MellowPet

Agente D (testador de navegação), branch `feat/cuidador-ux-navegacao`, 30/10/2026. Nenhum código de produção foi alterado.

- **Fontes:** leitura de `app/src/state/AppContext.tsx`, `app/src/navigation/RootNavigator.tsx`, `app/src/components/ui.tsx`, `app/src/components/TabBar.tsx`, `app/src/auth/authClient.ts` e das telas. Completa o levantamento de `docs/ux/navegacao-atual.md` (seção 5), que traz a tabela de telas e de deep links.
- **Aparelho:** Android `42fcf75c`, pacote `com.mellowpet.app`, logado no **perfil usuário**. O perfil cuidador não foi exercitado no aparelho, porque seria preciso fazer logout. O `uiautomator dump` falha nesse app ("could not get idle state", por causa da animação contínua), então a navegação foi feita por coordenadas e conferida por screenshot. Os screenshots estão no scratchpad da sessão (`d*.png`, `M*.png`).
- **Testes:** `app/tests/nav_contract.test.mjs` tem 34 casos. Todos falham até o Agente G criar `app/src/navigation/navModel.ts` e ligá-lo ao app, exceto o de sanidade (1 passa, 33 falham). Validei o contrato com uma implementação de referência descartável: os 29 casos do modelo passam com ela. Os 5 casos de integração leem o código de produção e continuam vermelhos até a correção.

Legenda: **[APARELHO]** = reproduzido no celular. **[CÓDIGO]** = visto só na leitura do código.

---

## Resumo por prioridade

| # | Prioridade | Problema | Onde viu |
|---|---|---|---|
| 1 | Crítico | Não existe guard por perfil: qualquer `screen` abre para qualquer `role` | CÓDIGO |
| 2 | Crítico | Cuidador cai na Home do pet e em telas de usuário por widget, notificação, Chat e NowPlayingBar | CÓDIGO |
| 3 | Alto | Usuário cai em `carealerts`/`care` por notificação `care_*` ou por `pendingScreen` antigo | CÓDIGO |
| 4 | Alto | Voltar físico depois de Cancelar/Salvar/Excluir reabre o formulário (Playlist, Spotify) | APARELHO |
| 5 | Alto | `pendingScreen` sobrevive ao logout e é aplicado na próxima conta, de qualquer perfil | CÓDIGO |
| 6 | Alto | Voltar físico no onboarding e no cadastro de cuidador pula o fluxo; o "Voltar" visual faz outra coisa (logout) | CÓDIGO |
| 7 | Médio | Ciclo `checkin` ↔ `heatmap` na pilha: o voltar fica indo e vindo | APARELHO |
| 8 | Médio | Na raiz (Home), o voltar físico reabre a tela anterior em vez de sair (Guia → tour → Home) | APARELHO |
| 9 | Médio | Voltar visual e voltar físico divergem em telas-raiz abertas com `go` | CÓDIGO (e APARELHO no #8) |
| 10 | Médio | `TAB_ROOTS` do título é a união das duas TabBars | CÓDIGO |
| 11 | Médio | `playlistdetail` volta mostrando a playlist errada (parâmetro implícito `openPlaylistId`) | CÓDIGO |
| 12 | Médio | Alertas abertos por push mostram a pessoa selecionada por último, não a do alerta | CÓDIGO |
| 13 | Médio | Sessão expirada: a API 401 não leva ao login, e o restore offline sem cache cai no splash | CÓDIGO |
| 14 | Médio | Deep link de widget com o app frio é atropelado pelo restore da sessão | CÓDIGO |
| 15 | Baixo | Tour (coach) não fecha com o voltar físico e reaparece | APARELHO |
| 16 | Baixo | Estado da aba se perde ao trocar de aba (scroll) | APARELHO |
| 17 | Baixo | Duplo toque rápido em voltar perde uma entrada da pilha | CÓDIGO |
| 18 | Baixo | Login → voltar físico sai do app em vez de voltar ao splash | CÓDIGO |
| 19 | Baixo | Telas quase órfãs e cards duplicados (`careaudit`, `careguide`, "Equipe e notas") | CÓDIGO |
| 20 | Baixo | Botão "Ver painel de cuidador" nunca aparece (código morto) | CÓDIGO |
| 21 | Baixo | Tela acessada sem histórico (deep link) fica sem "Voltar" no título | CÓDIGO |

Logout e sessão funcionam bem no caminho principal. `subscribeToSignOut` (`AppContext.tsx:780-802`) volta ao `INITIAL` (`history: []`, `screen: 'login'`), e o guard `PUBLIC_SCREENS` (`RootNavigator.tsx:93`, `:106`) só renderiza `login`/`splash` sem sessão. No login, o voltar físico sai do app (`RootNavigator.tsx:113`), então **não dá para voltar a uma tela autenticada depois do logout**. O que fica sujo é o que mora fora do reducer (itens 5, 13 e 14).

Telas sem saída: nenhuma tela autenticada ficou sem saída de verdade. Toda tela com abas tem a TabBar, e as telas de `NO_TABS` têm botão próprio (Chat, Visão e Player) ou só avançam (Onboarding). O mais perto de uma tela sem saída é o item 21.

---

## Crítico

### 1. Não existe guard por perfil
- **Onde:** `app/src/navigation/RootNavigator.tsx:102-107` e `:123`. O único guard é o de sessão (`PUBLIC_SCREENS`). `SCREENS[screen]` renderiza qualquer tela para qualquer `role`. Também não há checagem em `actions.go` (`AppContext.tsx:962`) nem no reducer (`:429-442`).
- **Reproduzir (código):** como cuidador, qualquer `dispatch({ screen: 'home' })` ou `go('music')` abre a tela do usuário, com a TabBar do cuidador por cima e nenhuma aba ativa.
- **Correção esperada:** `canAccess(screen, { authed, role })` do `navModel.ts`. Quando a tela é proibida, redirecionar para `homeFor(role, authed)`, no render e no reducer, para não sujar a pilha. Coberto por `nav_contract.test.mjs` ("cuidador não abre telas só de usuário", "usuário não abre telas só de cuidador", "RootNavigator usa canAccess").

### 2. Cuidador chega a telas só de usuário
- **Onde:**
  - Widgets: `widget/mood` e `widget/care` forçam `screen: 'home'` (`AppContext.tsx:834`, `:855`, `:870`). `widget/open` aceita `home/music/routine/spotifyplayer/checkin/heatmap` sem olhar o perfil (`:817-819`).
  - Notificações locais `ema`/`water` (`:905-908`) continuam agendadas depois de trocar de conta.
  - Chat do cuidador (botão na TabBar, `TabBar.tsx:81-82`): `runChatAction` vai para `home`, `music`, `lullaby` e `checkin` (`AppContext.tsx:1344-1351`). O atalho de crise leva a `sos` (`ChatScreen.tsx:286`) e daí a `crisisplan` (`SosScreen.tsx:150`), que é o plano de crise do próprio cuidador.
  - NowPlayingBar aparece para o cuidador (`RootNavigator.tsx:144`) e leva a `spotifyplayer`/`music` (`NowPlayingBar.tsx:82-83`, `:97`).
- **Reproduzir:** logado como cuidador, tocar no widget "Cuidar" (feed) da tela inicial do Android. O app abre a Home do pet (câmera e XP) com a TabBar do cuidador. Ou abrir o Chat, receber a ação "respirar" e tocar no botão: vai para a `home` do usuário.
- **Impacto:** o cuidador vê e mexe no pet e na câmera de uma conta que não é a da pessoa, e grava XP e hábitos na própria conta. A confusão de papéis é grave num app de cuidado.

---

## Alto

### 3. Usuário cai em telas de cuidador
- **Onde:** a notificação `care_alert(s)` vai para `carealerts` e `care_request(s)` vai para `care` (`AppContext.tsx:909-912`), sem checar `role`. O efeito do `pendingScreen` aplica o destino quando a tela é `home` **ou** `care`, sem olhar o perfil (`:634`).
- **Reproduzir (código):** aparelho que já foi de cuidador, onde chega um push `care_alert`, com login de usuário comum. Tocar na notificação abre `carealerts` com a TabBar do usuário. O `CareGate` mostra "Gere um convite" e leva a `caretools` (`CareStates.tsx:111`), que **cria um convite de cuidador para uma conta comum** (`CareToolsScreen.tsx:34`, `getOrCreatePendingInvite` no mount).
- **Agravante:** `ui.tsx:65` trata `carealerts`/`caretools` como raiz de aba (item 10), então a tela não tem "Voltar" no título.

### 4. Voltar físico depois de concluir um formulário reabre o formulário [APARELHO]
- **Onde:** o fim do fluxo usa `actions.go(<raiz>)` em vez de `back()`/`goTab()`:
  - `PlaylistEditorScreen.tsx:156` (salvar), `:342` ("Ir para Música"), `:352` (Cancelar)
  - `PlaylistDetailScreen.tsx:233` (não encontrada), `:557` (depois de **excluir**), `:588`
  - `SpotifyImportScreen.tsx:158` (depois de importar), `:177`, `:328`
  - `LullabyScreen.tsx:103` e `VisionScreen.tsx:54` (`go('home')`)

  O reducer empilha o formulário (`AppContext.tsx:433-436`).
- **Reproduzir (feito no aparelho):** aba **Música** → rolar → **Criar playlist de momento** → no editor, **Cancelar** (volta para Música) → **voltar físico** → **o editor "Nova playlist" reabre** (`d11_back_after_cancel.png`). Mais um voltar físico → Música; mais um → Home.
- **Variante pior (código):** excluir uma playlist (`PlaylistDetailScreen.tsx:557`) e apertar o voltar físico reabre o detalhe de uma playlist que não existe mais ("Essa playlist não existe mais.").
- **Correção esperada:** `back()` (ou `goTab` da raiz) nos finais de fluxo. Coberto por "fluxos que terminam ... voltam com back()/goTab".

### 5. `pendingScreen` sobrevive ao logout
- **Onde:** `AppContext.tsx:900` (`useRef`), preenchido em `:918` quando não há sessão. O reset do `SIGNED_OUT` (`:786-799`) não o limpa.
- **Reproduzir (código):** sem sessão, tocar numa notificação `care_alerts` de outra conta: o destino fica guardado. Depois fazer login como **usuário**. Ao chegar na `home`, o efeito `:631-637` abre `carealerts`, uma tela de cuidador para uma conta de usuário (ver item 3).
- **Correção esperada:** limpar o `pendingScreen` no `SIGNED_OUT` e validar o destino com `canAccess` antes de aplicar. Coberto por "logout limpa o destino pendente".

### 6. Onboarding e cadastro de cuidador: o voltar físico pula o fluxo
- **Onde:**
  - `onboarding` e `caresignup` estão em `NO_HISTORY` (`AppContext.tsx:427`), então chegam com a pilha vazia. O BackHandler (`RootNavigator.tsx:115-118`): `back()` falha, a tela não é raiz, e o handler chama `goTab(home)`.
  - No `caresignup`, o "Voltar" visual faz **logout** no passo 0 e volta um passo nos outros (`CareSignupScreen.tsx:96-102`). O físico manda direto para `care` sem concluir o fluxo do convite (o `setRole('care')` de `:297` nunca roda, mas o `role` já é `care`).
  - No `onboarding`, o físico pula a configuração do pet e vai para a `home`.
  - Além disso, a notificação aplicada com sessão (`AppContext.tsx:915-916`) tira a pessoa do onboarding/cadastro sem caminho de volta (já registrado em `navegacao-atual.md` §5.4-21).
- **Reproduzir (código):** criar conta de cuidador → primeira tela do cadastro → voltar físico → cai no Painel. Já o "Voltar" do topo da mesma tela faz logout. Os dois comportamentos são opostos.
- **Correção esperada:** nessas telas, o voltar físico deve fazer o mesmo que o botão da tela: voltar o passo ou pedir confirmação antes de sair.

---

## Médio

### 7. Ciclo `checkin` ↔ `heatmap` [APARELHO]
- **Onde:** `CheckinScreen.tsx:496` (`go('heatmap')`, "Ver o mês") e `HeatmapScreen.tsx:295` (`go('checkin')`, "Fazer check-in"). Também `DashboardScreen.tsx:128` e `HomeScreen.tsx:650`.
- **Reproduzir (feito):** **Bem-estar** → **Mapa emocional** → **Fazer check-in** → rolar → **Ver o mês**. Pilha: `[dashboard, heatmap, checkin]`. Voltar físico: Check-in → Mapa → Bem-estar → Home → sai do app (`M15.png`). Cada ida e volta acrescenta duas entradas, até 20.
- **Correção esperada:** se o destino já está na pilha logo abaixo do topo, fazer `back()` em vez de `go`. Outra opção é o `pushHistory` "desenrolar" até a ocorrência anterior. O contrato garante pelo menos que o `popHistory` sempre encurta a pilha ("popHistory é puro e repetido esvazia a pilha sem loop").

### 8. Na Home, o voltar físico reabre a tela anterior [APARELHO]
- **Onde:** `RootNavigator.tsx:115`: `actions.back()` é tentado **antes** de `atRoot`. `GuideScreen.tsx:55` ("Iniciar tour") faz `set({ screen: 'home' })`, e o reducer empilha `guide`.
- **Reproduzir (feito):** Home → **?** (Guia) → **Iniciar** (tour) → Home com o tour aberto → **voltar físico** → **o Guia reabre** (`d26_back_from_tour.png`). O mesmo acontece com Chat → ação "respirar" → Home → voltar → Chat.
- **Correção esperada:** atalhos que "voltam para a Home" devem usar `goTab('home')`. Se a pilha não for zerada, decidir se na raiz o voltar sai do app ou desempilha, e fazer o título concordar com essa escolha (item 9).

### 9. Voltar visual ≠ voltar físico nas raízes abertas com `go`
- **Onde:** `ui.tsx:71` esconde o "Voltar" em `TAB_ROOTS` mesmo com histórico, mas o físico desempilha (`RootNavigator.tsx:115`). Casos: `CareScreen.tsx:140`, `:152`, `:155`, `:160` (Painel → Alertas/Dados/Agenda/Mais), `CareStates.tsx:111` ("Criar convite" → `caretools`), `CareGuideScreen.tsx:11-14` (`go('care')`, `go('dashboard')`...), `LullabyScreen.tsx:103`, `VisionScreen.tsx:54`, `GuideScreen.tsx:55`.
- **Reproduzir:** cuidador → Painel → atalho **Alertas** → a tela não tem "Voltar" e a aba Alertas aparece ativa, mas o voltar físico volta para o Painel. No usuário, o mesmo padrão foi visto no item 8.
- **Correção esperada:** atalhos para telas que são abas usam `goTab`, ou o título mostra "Voltar" sempre que a pilha não está vazia.

### 10. `TAB_ROOTS` do título é a união dos dois perfis
- **Onde:** `app/src/components/ui.tsx:65`, com `['home','tools','routine','music','dashboard','care','carealerts','agenda','caretools']`.
- **Efeito:** um usuário que cai em `carealerts`/`caretools` (itens 3 e 5), ou um cuidador que cai em `home`/`music`/`tools` (item 2), não vê "Voltar", e nenhuma aba da TabBar dele está ativa. A correção é usar `TAB_ROOTS_USER`/`TAB_ROOTS_CARE` conforme o `role`. Coberto por "Voltar do título usa as raízes do perfil atual".

### 11. `playlistdetail` depende de `state.openPlaylistId`
- **Onde:** `MusicScreen.tsx:55-58` e `SpotifyPlayerScreen.tsx:297-302` definem `openPlaylistId` e trocam de tela. A pilha guarda só o nome da tela, não o parâmetro.
- **Reproduzir (código):** Música → playlist A (detalhe) → barra "tocando agora" → Player → abrir a fila (playlist B) → detalhe B → voltar → Player → voltar → **detalhe mostra B, não A**. Com a playlist A excluída, a tela mostra "não encontrada" (`PlaylistDetailScreen.tsx:226-233`).
- **Correção esperada:** guardar o parâmetro junto da entrada da pilha (por exemplo `{ screen, params }`) ou limpar `openPlaylistId` ao sair da tela.

### 12. Telas do cuidador sem o vínculo certo
- **Onde:** `CareStates.tsx:15-19`. `pickCurrent(links, state.person)` cai em `links[0]` quando falta a seleção. O push só traz `{ kind }` (`supabase/functions/care-push/index.ts:62`) e o toque abre `carealerts` (`AppContext.tsx:909-910`).
- **O que funciona:** o `CareGate` (`CareStates.tsx:75-129`) trata bem a falta de vínculo: mostra carregando, erro ou "sem ninguém conectado" com o botão "Criar convite", e só renderiza o conteúdo com uma pessoa selecionada. Não há tela de cuidador quebrada por falta de parâmetro.
- **Problema:** com 2 ou mais pessoas acompanhadas, o alerta da pessoa B abre na pessoa A se A foi a última selecionada. O cuidador pode achar que "não há alerta". O payload precisa levar o `link_id`, e o handler precisa fazer `set({ person })` antes de navegar.

### 13. Sessão expirada
- **Como é tratada hoje:** `authClient.ts:157-162` só reage a `SIGNED_OUT` do Supabase (refresh token revogado ou expirado). Nesse caso o estado volta ao início e vai para o login (`AppContext.tsx:780-802`). Isso está correto e cobre "voltar depois de logout".
- **Lacunas:**
  - A API própria responde 401 (`api/client.ts:41-44`, `chat/chatClient.ts:54-55`) e isso vira só um erro de tela. Não há sign-out nem tela de "sessão expirada".
  - `supabase/client.ts:21` usa `autoRefreshToken` sem `startAutoRefresh`/`stopAutoRefresh` no `AppState` (padrão recomendado para RN). Depois de muito tempo em segundo plano, a primeira chamada pode sair com o token vencido.
  - `loadStoredSession` offline sem papel em cache lança erro (`authClient.ts:84-87`). O app fica no splash com `userId` nulo (`AppContext.tsx:772-774`), embora a sessão do Supabase continue salva. Ao tocar "Entrar", a pessoa refaz o login sem saber por quê.
  - Depois de um re-login forçado, a pessoa volta para `home`/`care`, não para onde estava, e rascunhos (diário, check-in, editor) se perdem. Isso é aceitável, mas vale uma mensagem: "Sua sessão expirou, entre de novo".

### 14. Deep link de widget com o app frio é atropelado
- **Onde:** `Linking.getInitialURL` (`AppContext.tsx:889-891`) despacha a tela, e logo depois o `loadStoredSession` sobrescreve com `home`/`care` (`:752-760`). Sem sessão, o guard mostra `login`, mas o `state.screen` fica com a tela do widget. Depois do login, essa tela entra na pilha (o reducer empilha o `screen` antigo, que não está em `NO_HISTORY`), e o primeiro voltar leva a ela, de qualquer perfil.
- **Correção esperada:** usar o mesmo mecanismo do `pendingScreen` (já validado com `canAccess`) para os deep links.

---

## Baixo

### 15. Tour (coach) e voltar físico [APARELHO]
O tour é um overlay (`RootNavigator.tsx:125`, `:146`) e o voltar físico não o fecha: sai da Home (item 8). De volta à Home, o tour reaparece no passo 1 (`d27_home_tour_again.png`). O voltar físico deveria fechar o tour ou avançar um passo.

### 16. Estado da aba perdido ao trocar de aba [APARELHO]
Não existe pilha montada: cada troca desmonta a tela (`RootNavigator.tsx:123`, `:142`). Reproduzido: Ferramentas rolada até o fim → Rotina → Ferramentas volta ao topo (`M5.png`). O **rascunho do Diário rápido sobreviveu** à ida a SOS → Plano de crise → Voltar → Voltar (`c23.png`), então esse campo já guarda o texto. O rascunho foi apagado depois do teste, sem salvar nada. Rascunhos de outras telas (check-in, editor de playlist) não foram verificados no aparelho e, pelo código, ficam em `useState` local.

### 17. Duplo toque rápido em voltar
`actions.back` lê `ref.current.history` (`AppContext.tsx:966-969`), que só atualiza no render. Dois toques antes do re-render calculam o mesmo `target`: o segundo descarta mais uma entrada da pilha e não muda de tela. A correção é calcular dentro do `dispatch` funcional, com o `popHistory` puro.

### 18. Login → voltar físico sai do app
Sem sessão, o handler devolve `false` (`RootNavigator.tsx:113`). Quem veio do splash ("Entrar", `SplashScreen.tsx:118`) e aperta voltar fecha o app em vez de voltar ao splash. Está no limite do aceitável: o contrato só exige que o voltar sem sessão nunca leve a uma tela autenticada.

### 19. Telas quase órfãs e cards duplicados
- `careaudit` só é alcançável pelo card "Histórico" de CareTools (`data/content.ts:415`). `careguide` só pelo card de `CareToolsScreen.tsx:122`.
- "Plano de cuidado" e "Equipe e notas" levam os dois a `careplan` (`content.ts:412`, `:414`).
- No SOS, "Adicione em Ajustes → Contatos de emergência" é só texto, sem link para Ajustes (visto no aparelho, `d19_sos.png`).
- No Mapa emocional, o texto do botão "Fazer check-in" aparece cortado (`d33_heatmap.png`). É problema visual, não de navegação.

### 20. "Ver painel de cuidador" nunca aparece
`SettingsScreen.tsx:552` exige `accountRole === 'care'`, mas fica dentro do bloco `role !== 'care'` (`:270`), e não existe `setRole('user')`. Na prática é código morto. O Guia promete um caminho que não existe (ver `navegacao-atual.md` §5.3-12).

### 21. Tela aberta sem histórico fica sem "Voltar" no título
Uma tela que não é raiz e foi aberta com a pilha vazia (widget `open?screen=heatmap` depois de `goTab`, notificação `ema` → `checkin` sem passar pela Home) não mostra "Voltar" (`ui.tsx:71` exige `history.length > 0`). O voltar físico funciona (vai para a home do perfil), mas no iOS, ou para quem não usa o físico, a saída fica só na TabBar. A correção é mostrar "Voltar" com fallback para `homeFor(role)`, igual ao `popHistory` com a pilha vazia.

---

## Roteiro executado no aparelho (perfil usuário)

| Passo | Resultado | Screenshot |
|---|---|---|
| Home → Ajustes (ícone) → voltar físico | Home ✔ | `d02_settings`, `d03_after_back` |
| Aba Música → Criar playlist → Cancelar → voltar físico | **reabre o editor** ✖ (item 4) | `d10`, `d11_back_after_cancel` |
| Música (pilha vazia) → voltar físico | Home ✔ | `d13_back_from_music` |
| Ferramentas rolada → Rotina → Ferramentas | volta ao topo (item 16) | `d14`–`d16` |
| Ferramentas → Preciso de ajuda (SOS) → Meu plano de crise → Voltar do título ×2 | Ferramentas ✔, rascunho mantido | `d19`–`d22`, `c23` |
| Home → Guia → Iniciar tour → voltar físico | **reabre o Guia**, o tour não fecha ✖ (itens 8 e 15) | `d25`, `d26` |
| Guia → Voltar do título | Home com o tour de novo | `d27` |
| Bem-estar → Chat → voltar físico | Bem-estar ✔ | `d29_chat`, `d30_back_chat` |
| Bem-estar → Mapa → Check-in → Ver o mês → voltar ×5 | Check-in → Mapa → Bem-estar → Home → sai do app; ciclo na pilha ✖ (item 7) | `M15` |

Não foram feitos logout, envio de convites, alertas, pedidos ou registros. O tour foi pulado ("Pular") e o rascunho digitado no Diário foi apagado sem salvar.
