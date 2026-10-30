# Auditoria de UX — MellowPet (app/src)

Branch auditada: `feat/cuidador-ux-navegacao`. Auditoria estática de código (sem rodar no aparelho).
Foco: telas do cuidador primeiro, depois as do usuário principal.
Severidade: **Crítico** (pode deixar alguém sem ajuda, perder dado ou tornar a tela inutilizável) · **Alto** · **Médio** · **Baixo**.

Contrastes calculados pela fórmula WCAG a partir de `app/src/theme/palette.ts`.

---

## Os 10 problemas mais importantes

| # | Sev. | Problema | Onde | Correção sugerida |
|---|------|----------|------|-------------------|
| 1 | Crítico | O pedido "preciso de você" (`CareRequestsBanner`) só aparece quando o resumo carregou com sucesso. Se o compartilhamento está pausado, se o resumo ainda carrega ou se a busca falhou, o pedido de contato **não aparece no painel**. | `screens/CareScreen.tsx:150-151` | Renderizar `CareRequestsBanner` antes da cadeia pausado/erro/carregando, sempre que houver `current`. |
| 2 | Crítico | No modo escuro `T.pri` é `#C6A9F0`, e o texto/ícone branco sobre ele fica com contraste de **2,3:1**. Isso pega todos os `PrimaryButton` (inclusive "Ligar para o CVV") e cerca de 40 botões com `c="#fff"`. | `components/ui.tsx:375`, `screens/SosScreen.tsx:72`, `screens/ChatScreen.tsx:315,392`, `components/TabBar.tsx:99` | Criar o token `T.onPri` (claro `#fff`, escuro `#241730`) e trocar todos os `'#fff'` sobre `T.pri`. |
| 3 | Crítico (Android) | Nenhuma tela com `ScreenScroll` trata o teclado. O próprio `useKeyboardHeight` diz que o `KeyboardAvoidingView` não funciona no Android edge-to-edge, então os campos de baixo ficam embaixo do teclado (Plano, Agenda, Check-in, Ajustes, Rotina, Plano de crise, Grupos). | `components/ScreenScroll.tsx:27-35`, `screens/CareSignupScreen.tsx:85` | Em `ScreenScroll`, somar `useKeyboardHeight()` ao `paddingBottom` e ligar `automaticallyAdjustKeyboardInsets` (iOS). No CareSignup, trocar o KAV pelo hook. |
| 4 | Alto | No Plano de cuidado, salvar uma nota ou um membro chama `loaded.refresh()`. O `useEffect` então preenche de novo título, sinais e passos com o que está no servidor, e **as edições do plano ainda não salvas são perdidas**. | `screens/CarePlanScreen.tsx:81-86,110` | Preencher o formulário só no primeiro carregamento (ref `filled`), ou dar refresh apenas na parte alterada (`team`/`notes`). |
| 5 | Alto | `Touchable` não tem `accessibilityRole` padrão, `hitSlop` nem `minHeight`. Há dezenas de botões só de texto ou ícone com menos de 44 px, inclusive na tela de crise. | `components/ui.tsx:130-137`, `SosScreen.tsx:119-132`, `RoutineScreen.tsx:176`, `CheckinScreen.tsx:562`, `SettingsScreen.tsx:834`, `HomeScreen.tsx:372` | Corrigir uma vez no `Touchable` (veja Padrões, item S1) e criar um `LinkButton` com `minHeight: 44`. |
| 6 | Alto | A mensagem de sucesso ou erro aparece **no topo** de formulários longos. Quem toca em "Guardar nota" ou "Salvar compromisso", no fim da tela, não vê o resultado. | `CarePlanScreen.tsx:175-183`, `AgendaScreen.tsx:136-144`, `SettingsScreen.tsx:251-262` | Mostrar a mensagem junto do botão que disparou a ação, ou rolar até ela com `scrollTo`. |
| 7 | Alto | Perda de texto digitado: os campos são limpos **antes** de a requisição terminar e não voltam se der erro. | `CarePlanScreen.tsx:147,165-166`, `AgendaScreen.tsx:126` | Limpar só no sucesso, como o `RoutineScreen.tsx:113` já faz com `setNameInput(name)`. |
| 8 | Alto | Uma falha no polling de 60 s do painel do cuidador chama `setLoaded(null)` e troca o painel inteiro por um cartão de erro. Uma rede instável faz o painel piscar e some com o que já estava na tela. | `CareScreen.tsx:76-79` | Manter `loaded` em caso de erro e mostrar só uma faixa "sem conexão, dados de HH:mm", como já é feito com os vínculos na linha 141. |
| 9 | Alto | Na tela Bem-estar, um erro de rede aparece como "Ainda não há leituras suficientes". O erro se disfarça de lista vazia e não há como tentar de novo. | `DashboardScreen.tsx:48-50,165-178` | Guardar `error` à parte e renderizar um `ErrorCard` com "Tentar novamente". |
| 10 | Alto | `T.t3` no tema claro (`#9CA3AF` sobre branco) tem contraste de **2,5:1** e é usado em quase todo texto explicativo (11,5–12,5 px). `OK` e `WARN` como cor de texto no claro ficam em cerca de 2,5:1 e 2,1:1. | `theme/palette.ts:37,72-73`; ex.: `CareScreen.tsx:141`, `CareAlertsScreen.tsx:78` | Escurecer `t3` no claro para cerca de `#6E7480` (≥4,5:1). Para texto em OK/WARN, criar variantes escuras (`okText`, `warnText`) por tema. |

Quase no top 10: o destrutivo "Encerrar acompanhamento" aparece acima de todo o conteúdo do painel (`CareScreen.tsx:149`); a Agenda pede data em texto livre "AAAA-MM-DD HH:mm" (`AgendaScreen.tsx:155-165,207-217`); TabBar, Toggle, Chip e Segmented não têm papel nem estado para o leitor de tela.

---

## Padrões sistêmicos (corrigir uma vez e resolver em vários lugares)

| ID | Sev. | Padrão | Corrigir em | Correção |
|----|------|--------|-------------|----------|
| S1 | Alto | `Touchable` não define `accessibilityRole`, não repassa `disabled` para `accessibilityState` e não tem área mínima de toque. Além disso, `[{opacity: pressed}, style]` deixa qualquer `opacity` do `style` (por exemplo `opacity: busy ? 0.5 : 1`, `dim`) **anular o feedback de toque**. | `components/ui.tsx:130-137` | `accessibilityRole='button'` por padrão, `accessibilityState={{disabled, ...}}`, `hitSlop` padrão de 8 e opacidade combinada: `(style.opacity ?? 1) * (pressed ? 0.7 : 1)`. |
| S2 | Crítico | Branco fixo sobre `T.pri`, com 2,3:1 no escuro. | `ui.tsx:288,375`; 44 ocorrências de `#fff` em screens/components | Token `T.onPri` em `Palette`. |
| S3 | Alto | `PrimaryButton` não tem `loading` nem `accessibilityState`, e cada tela improvisa: troca o rótulo ("Salvando…"), troca o botão por um spinner (`CheckinScreen.tsx:476-479`) ou não faz nada (`RoutineScreen.tsx:222`). | `ui.tsx:349-380` | Props `loading` (spinner + `disabled` + `accessibilityState.busy`) e `accessibilityRole="button"`. |
| S4 | Crítico (Android) | Teclado cobrindo campos em todas as telas com `ScreenScroll`. | `ScreenScroll.tsx` | Veja o top 10, item 3. |
| S5 | Alto | Controles sem papel ou estado: `Toggle` (sem `switch`/`checked`/label), `Chip` (sem `selected`), `Segmented` (sem `tab`/`selected`), `TabBar` (sem `tab`/`selected`). | `ui.tsx:156,275,318`; `TabBar.tsx:62-77` | `Toggle`: `accessibilityRole="switch"`, `accessibilityState={{checked:on}}` e prop `label`. `ToggleRow` repassa `label`. Chip/Segmented/Tab: `accessibilityState={{selected}}`. |
| S6 | Alto | Botões que são só texto ("Tentar novamente", "Entendi", "Ver plano", "Ligar", "SMS", "Remover", "Depois", "Respirar 1 minuto", "Adicionar à equipe", "Guardar nota privada") têm de 16 a 20 px de altura útil. | `CareStates.tsx:44,61`, `CareLinksErrorCard.tsx:18`, `CarePresence.tsx:329`, `CarePlanScreen.tsx:250,277` etc. | Componente `LinkButton` em `ui.tsx` (`minHeight: 44`, `justifyContent: 'center'`, papel `button`). |
| S7 | Alto | Feedback de ação longe do botão (topo do formulário). | CarePlan, Agenda, Ajustes | Mensagem junto do botão. Aproveitar `ActionError` de `CareStates.tsx:54` com variante `ok`. |
| S8 | Alto | Erro tratado como vazio, ou erro que apaga o conteúdo já carregado. | Dashboard, CareScreen (poll), Sos (contatos), `CareRequestsBanner` | Regra: o erro **nunca** substitui dado que já está na tela; quando não há dado, mostrar `ErrorCard` com retry. |
| S9 | Médio | Cerca de 45 textos fixos com `s < 11` (8,5–10,5 px): rótulos de gráfico, abas, eyebrows, legendas. | `HeatmapScreen` (7), `DashboardScreen` (4), `CheckinScreen` (4), `CareScreen` (4), `CareDataScreen.tsx:113,124`, `CarePresence.tsx:67`, `TabBar.tsx:74` | Piso de 11 px. Para rótulos de gráfico, 11 px com abreviação. Conferir com "Tamanho da fonte" do sistema em 130%. |
| S10 | Médio | Cartões de loading/erro reimplementados dentro das telas em vez de usar `CareStates`. | `CareScreen.tsx:140,148,150`; mensagens em `AgendaScreen.tsx:136`, `CarePlanScreen.tsx:175` | Usar `LoadingCard` / `ErrorCard` / `ActionError`. |
| S11 | Médio | `ScreenScroll` não tem pull-to-refresh. Nas telas do cuidador (Alertas, Agenda, Histórico) só dá para atualizar saindo e voltando. | `ScreenScroll.tsx:27` | Prop opcional `onRefresh` com `RefreshControl` (cor `T.pri`). |
| S12 | Médio | `Field`: o rótulo não fica associado ao `TextInput`, o erro não é anunciado, e `style` (margem) vai para o input em vez do contêiner. Isso abre espaço entre rótulo e campo e cola um campo no outro. | `components/Field.tsx:45-84,107-113`; uso: `CarePlanScreen.tsx:193-209,248`, `AgendaScreen.tsx:154,206` | `accessibilityLabel={label}` no input, `accessibilityLiveRegion="polite"` no erro, e `gap` no contêiner do formulário em vez de `style.marginTop`. |
| S13 | Baixo | `ScreenTitle` não marca o título como cabeçalho. | `ui.tsx:91` | `accessibilityRole="header"` no `Txt` do título. |
| S14 | Médio | `T.pri` claro (`#6C63FF`) como texto de link 12,5 px tem 4,3:1 sobre branco e cerca de 3,9:1 sobre `T.priL`. `DANGER` sobre `surf` escuro fica em 3,5:1. | `palette.ts:38,74` | Escurecer levemente `pri` no claro (`#5B52F0`) e usar `DANGER` mais claro no escuro (`#FF7A7A`). |

---

## Telas do cuidador

### CareScreen (Painel) — `app/src/screens/CareScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Crítico | 150-151 | O pedido de contato fica oculto quando a pessoa está pausada, quando o resumo carrega ou quando dá erro. | Mover `CareRequestsBanner` para fora do ternário, logo após o seletor. |
| Alto | 149 | "Encerrar acompanhamento" (destrutivo) aparece como 2º bloco, antes de alertas e dados, em toda visita. | Mover para o fim da tela ou para Ajustes/Recursos, atrás de "Gerenciar vínculo". |
| Alto | 76-79 | Erro no poll apaga `loaded` e o painel vira um cartão de erro. | Manter os dados e mostrar uma faixa de "desatualizado". |
| Médio | 133-139 | Cabeçalho próprio (s 10,5/25) diferente do `ScreenTitle` (11/32) das outras abas. O botão de tema no cabeçalho do painel é ruído. | Usar `ScreenTitle` com slot de ações à direita e tirar o toggle de tema daqui (já está em Ajustes). |
| Médio | 142-147 | Seletor de pessoa próprio (cartões horizontais), diferente do `CarePersonPicker` das outras telas. O status "toque para ver" com cor `WARN` sugere alerta. | Unificar com `CarePersonPicker`. Status neutro (`T.t3`) para pessoas não carregadas. |
| Médio | 141 | Aviso offline em `WARN` sobre fundo claro (2,1:1), com s 11,5. | Usar `warnText` escuro e um ícone. |
| Médio | 155 | "Ver evolução" é texto 11,5 px sem área de toque e duplica "Abrir relatório completo" logo abaixo. | Deixar um só link, com `LinkButton`. |
| Baixo | 154, 160 | Textos de 10,5 px (contagem de leituras, subtítulos dos atalhos). | Subir para 11,5. |
| Baixo | 140, 148, 150 | Loading, erro e erro de ação reimplementados inline. | Usar `CareStates`. |

### CarePresence (componentes do painel) — `app/src/components/CarePresence.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 105-117 | `listOpenRequests` sem `.catch`: se falha, não há aviso nenhum e o cuidador acha que não há pedidos. | `.catch` com uma linha "não foi possível verificar pedidos — tentar de novo". |
| Médio | 138-143 | Se o "Vi, vou falar" falha, a lista volta (com uma closure velha `requests`) sem mensagem. O botão não trava durante o envio. | Estado `busy` e `error` próprios. Restaurar com `setRequests(prev => [top, ...prev])`. |
| Médio | 124-129 | Só o primeiro pedido aparece. Com vários, os outros ficam invisíveis. O texto diz "Ligue", mas não há ação de ligar. | Mostrar "+N pedidos" e um botão "Ligar" ou "Mensagem" quando houver contato. |
| Médio | 178-179, 191-195 | Sucesso e erro do carinho aparecem no mesmo estilo (`T.t2`). Durante o envio todos os botões ficam só a 0,5 de opacidade, sem indicar qual foi tocado. | Cor e ícone por tom (OK/DANGER), `accessibilityRole="alert"` no erro e rótulo "Enviando…" no botão tocado. |
| Médio | 321-334 | "Respirar 1 minuto" não tem botão de parar e ignora "reduzir movimento". | Botão "Parar" e `AccessibilityInfo.isReduceMotionEnabled`. |
| Médio | 67, 82, 87 | Dias da semana em 9 px e legenda em 10,5 px. | Pelo menos 11 px. |
| Baixo | 304 | Chip de sentimento selecionado com `#fff` sobre `T.pri` (escuro). | `T.onPri`. |
| Baixo | 296-309 | O sentimento escolhido não é guardado nem tem efeito além do texto. | Persistir no SecureStore ou deixar claro que é só um exercício. |

### CareAlertsScreen — `app/src/screens/CareAlertsScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 28 | Não há polling nem pull-to-refresh: um alerta urgente novo só aparece ao sair e voltar. | `refresh` a cada 60 s ou `RefreshControl` (S11). |
| Médio | 139-151 | O retorno ("falso alarme" etc.) resolve o alerta de forma irreversível, sem confirmação e sem explicar que isso ajusta o limiar. | Uma linha explicativa e "Desfazer" por alguns segundos, ou confirmação. |
| Médio | 117-131 | Botões de 12 px com paddingVertical 10 (cerca de 36 px). "Ver plano" não tem fundo, então não parece botão. | Usar `minHeight: 44` (S1/S6). |
| Baixo | 34 | `busy` é global: tocar em outro alerta durante um envio é ignorado em silêncio, e o botão parece ativo. | Desabilitar todos os botões enquanto `busy !== null`. |
| Baixo | 105, 112 | Data no canto e aviso com 10,5 px. O aviso se repete em todo cartão. | 11,5 px. Mostrar o aviso uma vez, no topo da lista. |

### CareDataScreen (Dados/Evolução) — `app/src/screens/CareDataScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 110-129 | O gráfico de cobertura não tem descrição acessível. Números em 9 px e dias em 8,5 px. | `accessible` + `accessibilityLabel` com o resumo (como `ValenceTrend`). Rótulos com 11 px. |
| Médio | 54 | `Segmented` sem papel ou estado (S5). Trocar o período apaga tudo e mostra o loading, e a tela "pula". | Manter os dados anteriores com opacidade enquanto carrega. |
| Baixo | 88-92 | "Compartilhar resumo" é texto sem área de toque. | `LinkButton`. |
| Baixo | 84 | Contagem em 10,5 px. | 11,5. |

### CarePlanScreen — `app/src/screens/CarePlanScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 81-86, 110 | O refresh após salvar nota ou membro sobrescreve as edições não salvas do plano. | Preencher só uma vez por pessoa. |
| Alto | 147, 165-166 | A nota e os campos do membro são limpos antes do sucesso. Com erro, o texto se perde. | Limpar no sucesso. |
| Alto | 175-183 | A mensagem aparece no topo e fica fora da tela para ações de baixo. Ela também nunca some e não tem como fechar. | Mensagem por seção, com fechamento ou auto-dismiss em 4 s para sucesso. |
| Alto | 269-276 | Campos multiline no fim da tela ficam cobertos pelo teclado (S4). | S4. |
| Médio | 193-209, 248-249 | Campos colados uns nos outros. `style.marginTop` vai para o input e separa o rótulo do campo. | `gap: 12` no contêiner e `containerStyle` para margens. |
| Médio | 250-254, 277-281 | "Adicionar à equipe" e "Guardar nota" são texto 12,5 px sem botão, ao lado de um `PrimaryButton` no mesmo cartão. Hierarquia inconsistente. | Botão secundário (fundo `priL`, 44 px). |
| Médio | 110 | Se `refresh` falha depois de um save bem-sucedido, a tela inteira vira `ErrorCard` e a mensagem de sucesso some. | Refresh silencioso, sem trocar o formulário pelo erro. |
| Baixo | 283 | Só 4 notas aparecem e não há "ver todas". | Link "Ver todas (N)". |
| Baixo | 187, 221, 260 | Eyebrows com 11,5 px montados à mão. | Usar `Eyebrow`. |

### AgendaScreen — `app/src/screens/AgendaScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 155-165, 207-217 | Data e hora digitadas como "AAAA-MM-DD HH:mm" com teclado padrão: fácil de errar e lento. | `DateTimePicker` (já usado em `RoutineScreen.tsx:215`). |
| Alto | 126 | O título do compromisso é limpo antes do sucesso. | Limpar no sucesso. |
| Alto | 136-144 | A mensagem no topo fica fora da tela ao salvar um compromisso. Os erros de "pergunta vazia" e "título vazio" vão para o banner em vez do campo. | `error` no `Field` correspondente e mensagem junto do botão. |
| Alto | 206-217 | Os campos de compromisso, no fim da tela, ficam sob o teclado (S4). | S4. |
| Médio | 186-195 | Check-ins agendados não podem ser cancelados nem editados. | Ação "Cancelar" por item. |
| Baixo | 154, 206 | `style={{marginTop}}` no `Field` separa rótulo e input (S12). | `containerStyle`. |
| Baixo | 191, 237, 242 | Datas e erros em 11 px. | 11,5–12. |

### CareToolsScreen (Mais/Recursos) — `app/src/screens/CareToolsScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 121-130, 165-193, 198-205 | "Guia do cuidador", "Copiar", "Enviar" e "Tentar novamente" não têm `accessibilityRole` (S1). | S1. |
| Médio | 176 | "Copiado!" não é anunciado ao leitor de tela. | `AccessibilityInfo.announceForAccessibility('Código copiado')`. |
| Médio | 133-139 | O aviso (`notice`) aparece entre o Guia e o convite, com `top={0}`, colado no cartão de cima e longe dos botões que o geraram. | Mostrar dentro do cartão do convite, abaixo dos botões. |
| Baixo | 160 | O loading do código é só o texto "Gerando…", sem spinner. O erro (197) não tem `accessibilityRole="alert"`. | `ActivityIndicator` + `alert`. |
| Baixo | 221, 232 | `rgba` vermelho fixo. Funciona nos dois temas, mas fica fora dos tokens. | `hexA(DANGER, .32)`. |

### CareSignupScreen — `app/src/screens/CareSignupScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 85 | `behavior={undefined}` no Android: o KAV não faz nada (veja o comentário de `useKeyboardHeight`). O botão "Continuar" pode ficar sob o teclado. | `useKeyboardHeight` no `paddingBottom`. |
| Médio | 96-117 | Botão voltar de 36 px sem `accessibilityRole`. No passo 0 ele **faz logout** sem avisar. | 44 px, papel `button` e rótulo "Sair e voltar ao login" no passo 0, com confirmação. |
| Médio | 123-135 | A barra de progresso não é acessível e a troca de passo não é anunciada. | `accessibilityRole="progressbar"` com `accessibilityValue={{min:1,max:3,now:step+1}}`. Título com `header`. |
| Médio | 261-274 | "Marquei que enviei", depois de marcado, ganha visual de desabilitado mas continua tocável. `#fff` sobre `T.pri`. | `disabled` quando `invited`, mais `T.onPri`. |
| Baixo | 118 | "CONTA DE CUIDADOR · 1 de 3" em 10,5 px. | 11. |
| Baixo | 163-168 | Os chips de vínculo não anunciam seleção (S5). | S5. |

### CareGuideScreen — `app/src/screens/CareGuideScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 36-49 | Os passos são navegáveis, mas não têm papel nem chevron: parecem texto informativo. | `accessibilityRole="button"`, chevron à direita e label "Abrir …". |
| Baixo | 13-14 | O mesmo ícone (coração) em dois passos. | Ícones distintos. |

### CareAuditScreen — `app/src/screens/CareAuditScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Baixo | 58-67 | A lista não tem paginação nem agrupamento por dia. Fica longa com o uso. | Agrupar por data e carregar mais sob demanda. |
| Baixo | — | Os três estados estão corretos (loading, vazio, erro). | — |

### CareMirrorScreen (visto pela pessoa acompanhada) — `app/src/screens/CareMirrorScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Baixo | 22 | Sem `userId`, a chave é `null` e o loading fica para sempre. | Tratar `!userId` com uma mensagem. |
| Baixo | 62 | O índice (24 px) não tem `accessibilityLabel` (CareData tem). | Mesmo label de `CareDataScreen.tsx:77`. |

### CaredPresence (Home da pessoa acompanhada) — `app/src/components/CaredPresence.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 63-83 | Os botões de urgência só ficam a 0,5 de opacidade durante o envio, sem indicar qual foi tocado. Depois de enviado, não há como saber se o cuidador viu. | "Enviando…" no botão tocado e status "visto às HH:mm" quando houver ack. |
| Médio | 212-215 | O erro de pausar não tem `accessibilityRole="alert"`. Pausar 7 dias não pede confirmação. | `alert` e confirmação curta. |
| Baixo | 84-88, 154-158 | "Agora não" e "Receber o carinho" são texto sem área de toque (S6). | `LinkButton`. |
| Baixo | 113 | `nextUnseenGesture` sem `.catch` (rejeição não tratada). | `.catch(() => undefined)`. |
| Baixo | 74 | `rgba(229,72,77,.14)` fixo, num tom diferente de `DANGER`. | `hexA(DANGER, .14)`. |

### ChatScreen (modo cuidador e usuário) — `app/src/screens/ChatScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Médio | 104-105 | No modo cuidador, `state.messages` é global: ao trocar de pessoa acompanhada, a conversa (e o histórico enviado ao copiloto) continua sendo a da pessoa anterior. | Separar as mensagens por `care.current.id`, ou limpar ao trocar de pessoa. |
| Médio | 229-323 | As mensagens novas do bot e o "digitando" não são anunciados ao leitor de tela. | `accessibilityLiveRegion="polite"` na última mensagem do bot ou `announceForAccessibility`. |
| Médio | 169-171 | "Limpar conversa" apaga tudo sem confirmação e sem desfazer. | `Alert.alert` de confirmação. |
| Médio | 130-132, 169, 207, 286, 303, 379 | Os botões não têm `accessibilityRole`. O botão "Enviar" desabilitado não informa `disabled` (S1). | S1. |
| Baixo | 103 | No modo cuidador, enviar enquanto `typing` é ignorado em silêncio, porque o botão continua ativo. | `canSend = ... && !state.typing`. |
| Baixo | 276-282 | Os selos "NO APARELHO" e "NUVEM" têm 10 px. | 11 px. |
| Baixo | 294, 392 | `#E5484D` e `#fff` fixos. O ícone de enviar fica com contraste baixo no escuro. | `DANGER` e `T.onPri`. |
| Baixo | 362-378 | O `TextInput` não tem `accessibilityLabel` (depende do placeholder). | `accessibilityLabel="Mensagem"`. |
| — | 67, 346 | O teclado está bem tratado com `useKeyboardHeight` e serve de modelo para o S4. | — |

### TabBar — `app/src/components/TabBar.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 62-77 | As abas não têm `accessibilityRole="tab"` nem `accessibilityState.selected`. O leitor de tela não diz qual aba está ativa. | Adicionar papel e estado. `accessibilityRole="tablist"` no contêiner. |
| Médio | 74 | Rótulos com 9,5 px. "Ferramentas" mal cabe em cerca de 50 px de largura numa tela de 320 px. | 11 px com `numberOfLines={1}` e `adjustsFontSizeToFit`, ou rótulo menor ("Ferram."/"Kit"). |
| Baixo | 83 | No modo cuidador o botão diz "Conversar com o Mellow", mas abre "Apoio ao cuidador". | Rótulo por papel. |
| Baixo | 99 | Ícone `#fff` sobre `T.pri` no escuro. | `T.onPri`. |

---

## Telas do usuário principal

### HomeScreen — `app/src/screens/HomeScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 372-378 | O "X" de fechar o cartão do cuidador tem cerca de 28 px (ícone 16 + padding 6). | 44 px ou `hitSlop={10}`. |
| Médio | 599-636 | Os botões de feedback da leitura (✓ ✗ ?) têm 34 px, ficam colados e não confirmam o toque. | 44 px e um "Obrigado" com live region. |
| Médio | 261-285 | As pílulas "Modo foco" e "Respiração" são alternâncias sem `accessibilityState.selected` nem papel. | `accessibilityRole="switch"` (ou `button` com `selected`). |
| Médio | 84-108 | Ação apagada (`dim`) usa `opacity` no style: perde o feedback de toque (S1) e não informa por que está apagada. | S1 e `accessibilityHint`. |
| Baixo | 53, 104 | Rótulos de 10 e 9,5 px. | 11 px. |
| Baixo | 334-338 | "Depois" é texto sem área de toque, ao lado de um `PrimaryButton`. | `LinkButton`. |
| Baixo | 390, 625 | `#fff` e `#EF4444` fixos. | `T.onPri` e `DANGER`. |

### DashboardScreen (Bem-estar) — `app/src/screens/DashboardScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 48-50, 165-178 | O erro de rede aparece como "Ainda não há leituras suficientes", sem retry. | Estado de erro separado e `ErrorCard`. |
| Médio | 217, 253, 377, 391 | Rótulos de gráfico com 9,5–10 px. | 11 px. |
| Baixo | 76 | Falha do streak engolida (só afeta o widget). | OK manter, mas registrar em log. |

### CheckinScreen — `app/src/screens/CheckinScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 562-564 | O botão de apagar check-in tem cerca de 27 px (ícone 15 + padding 6), perto do cartão. | 44 px. |
| Alto | 420-428 | A nota multiline fica embaixo do teclado no Android (S4). | S4. |
| Médio | 471-479 | O erro ao registrar não tem `accessibilityRole="alert"`. O botão vira spinner (o layout pula). "Registrar" desabilitado não explica que falta escolher a emoção. | `PrimaryButton loading` (S3), `alert` e uma dica "Escolha como você está". |
| Médio | 389-407 | Os botões de sono não têm papel nem `selected`. O rótulo tem 9,5 px e `#fff` sobre `pri`. | `accessibilityState={{selected:on}}`, 11 px e `T.onPri`. |
| Baixo | 59 | Os botões de emoção têm label e estado, mas não têm papel. | S1. |
| Baixo | 121, 139, 554 | Textos de 10,5 px. | 11,5. |

### SettingsScreen — `app/src/screens/SettingsScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 834-838 | "Remover" contato de emergência é texto 11,5 px com padding 6 (cerca de 28 px), sem papel nem label com o nome. | 44 px, `accessibilityLabel` "Remover <nome>". |
| Alto | 843-860 | Os campos de contato e de código de convite ficam no fim de uma tela de cerca de 900 linhas e são cobertos pelo teclado (S4). | S4. |
| Médio | 251-262 | O erro de salvar aparece no topo de uma tela muito longa: quem mexeu num toggle lá embaixo não vê. | Faixa fixa (toast) ou mensagem junto da seção alterada. |
| Médio | — | A tela é muito longa e sem índice. Conta, privacidade, cuidador, contatos e sair ficam no mesmo scroll. | Agrupar em sub-telas ou acrescentar âncoras/seções colapsáveis. |
| Médio | 862-880 | "Adicionar contato" desabilitado não diz o que falta, e não há estado de salvando. | Dica e `loading`. |
| Baixo | 506 | "O que meu cuidador vê" é texto sem área de toque. | `LinkButton`. |
| Baixo | 706 | `#fff` fixo. | `T.onPri`. |

### SosScreen — `app/src/screens/SosScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 119-132 | "Ligar" e "SMS" para contatos de emergência são texto 12,5 px sem área de toque (cerca de 18 px de altura), justamente na tela de crise. | Botões de 48 px lado a lado. |
| Alto | 72 | "Ligar para o CVV" em `PrimaryButton`: branco sobre lilás no escuro (2,3:1). | `T.onPri` (S2). |
| Médio | 28-35 | Sem estado de carregando: aparece "Nenhum contato com telefone" antes de o cache ou o servidor responder. A falha do servidor é engolida. | Estado `loading` e, no vazio, o atalho "Adicionar contato" direto para Ajustes. |
| Médio | 100-105 | O `Toggle` de localização não tem label acessível (S5). | S5. |
| Baixo | 76-84, 149-166 | SAMU, Plano de crise e Falar com o Mellow têm label, mas não têm papel. | S1. |
| Baixo | 95 | O vazio pede "Ajustes → Contatos" sem botão. | Botão "Adicionar contato". |

### RoutineScreen — `app/src/screens/RoutineScreen.tsx`

| Sev. | Linha | Problema | Correção |
|------|-------|----------|----------|
| Alto | 176-178 | Remover item: ícone de 16 px com padding 4 (cerca de 24 px), sem label nem papel. | 44 px, `accessibilityLabel` "Remover <item>". |
| Alto | 175 | `Toggle` de lembrete sem label: o leitor de tela anuncia só "botão". | `label` "Lembrete de <item>" (S5). |
| Médio | 222-235 | "+ Adicionar" não mostra que está salvando nem trava visualmente (só ignora o toque). | `PrimaryButton loading`. |
| Médio | 191-206 | O botão de horário não tem label ("07:30" sem contexto). O campo de nome não tem rótulo, só placeholder. | `accessibilityLabel="Horário: 07:30, alterar"` e `label` no `Field`. |
| Baixo | 154-160 | O loading é só um spinner, sem texto. O erro está dentro de um Touchable com texto vermelho, sem botão claro de retry. | `LoadingCard` / `ErrorCard`. |
| Baixo | 258-271 | É possível "selar" a cápsula vazia, e não há como desfazer. | Desabilitar com texto vazio e confirmar. |
| Baixo | 232, 268 | `#fff` fixo. | `T.onPri`. |

---

## Componentes base

| Componente | Sev. | Linha | Problema | Correção |
|------------|------|-------|----------|----------|
| `ui.tsx` Touchable | Alto | 130-137 | Veja S1. | S1. |
| `ui.tsx` Toggle | Alto | 142-183 | Sem `accessibilityRole="switch"`, sem `checked`, sem label. A bolinha `#fff` com sombra `#000` está ok. | Prop `label` e papel/estado. |
| `ui.tsx` PrimaryButton | Crítico | 375 | `#fff` sobre `pri` no escuro. Sem `loading`, papel ou estado. | S2/S3. |
| `ui.tsx` Chip / Segmented | Médio | 275, 318 | Sem `selected`. `Segmented` com cerca de 36 px de altura. | S5 e `minHeight: 40`. |
| `ui.tsx` Eyebrow | Baixo | 58 | 11 px w800 em `t3`: contraste baixo no claro (veja o top 10, item 10). | Corrigir via `t3`. |
| `CareStates.tsx` | Médio | 44-48, 61-65 | "Tentar novamente" e "Entendi" são texto sem área de toque. O `ErrorCard` mostra `error.message` cru (pode ser técnico). | `LinkButton` e mapear a mensagem para um texto amigável. |
| `CarePersonPicker.tsx` | Baixo | 27-29 | O contêiner com `accessibilityLabel` sem `accessible` não é lido. O título tem 10,5 px. | `accessibilityRole="radiogroup"` nos itens e 11 px. |
| `Field.tsx` | Médio | 45-113 | Veja S12. | S12. |

---

## O que já está bom (manter)

- `CareGate` (`CareStates.tsx:75-129`) concentra loading, erro e vazio, com caminho para o convite. Bom padrão, e o `CareScreen` deveria usar também.
- `useCareResource` descarta resposta atrasada e limpa os dados ao trocar de pessoa: não mistura dados de duas pessoas.
- `CareAlertsScreen` trava por alerta e separa o erro da ação (`ActionError`) do erro de carregamento.
- `ChatScreen` trata o teclado do jeito certo para o Android edge-to-edge.
- Textos de cuidado (sem diagnóstico, sem vigilância) estão consistentes em todas as telas.
