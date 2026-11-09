# Problemas — Fase 2

Detalhes, passo a passo e arquivo:linha de cada item:
- Navegação (Agente D): [problemas-navegacao.md](problemas-navegacao.md) — 21 itens, testes em `app/tests/nav_contract.test.mjs`.
- UX (Agente E): [problemas-ux.md](problemas-ux.md) — top 10, 14 padrões sistêmicos, tabelas por tela.
- API e banco (Agente F): [problemas-api.md](problemas-api.md) — testes em `api/tests/test_care_api_audit.py` (172 passam, 10 `xfail` = bugs documentados).

Esta lista consolida os **Críticos e Altos**, que são obrigatórios na Fase 4. Coluna "Dono" = agente da Fase 4. A coluna "Status" é preenchida pelo Agente K na Fase 5.

| # | Prior. | Problema | Arquivo principal | Dono | Status |
|---|---|---|---|---|---|
| N1 | Crítico | Sem guard por perfil: cuidador abre Home do pet e telas do usuário (widget, Chat, NowPlayingBar, notificações `water`/`ema`) | `navigation/RootNavigator.tsx`, `state/AppContext.tsx` | G | ✅ `navModel.ts:16-88` (SCREEN_ACCESS/canAccess), `AppContext.tsx:458-483`, `RootNavigator.tsx:120,175` |
| N2 | Alto | Usuário abre telas de cuidador por notificação `care_*` | `state/AppContext.tsx` | G | ✅ `AppContext.tsx:697-699` (canAccess no destino externo) |
| N3 | Alto | Destino pendente de notificação sobrevive ao logout e vale para a próxima conta | `state/AppContext.tsx` | G | ✅ `AppContext.tsx:885` limpa destino; `:887-900` volta ao INITIAL (history []) |
| N4 | Alto | Onboarding e cadastro de cuidador: voltar físico pula o fluxo; "Voltar" da tela faz logout | `navigation/RootNavigator.tsx`, `CareSignupScreen.tsx` | G | ✅ `flowBack.ts:10-22`, `RootNavigator.tsx:135-143`, `CareSignupScreen.tsx:100` |
| N5 | Alto | Widgets apontam para telas fora da lista aceita (`care`, `agenda`, `tools`, `settings`); `tool?action=` e `playlist?id=` ignorados | `state/AppContext.tsx` | G | ✅ `deepLinks.ts:14-85`, `AppContext.tsx:918-931` |
| N6 | Alto | Voltar físico reabre editor de playlist após cancelar/salvar/excluir; Check-in ↔ Mapa emocional em ciclo; voltar na Home reabre o Guia | `PlaylistEditorScreen.tsx`, `CheckinScreen.tsx`, `AppContext.tsx` | G | ✅ `PlaylistEditorScreen.tsx:156,342`, `CheckinScreen.tsx:506`, `navModel.ts:115-126`, `RootNavigator.tsx:144` |
| N7 | Alto | Notificação `care_alerts` abre a última pessoa selecionada, não quem gerou o alerta | `AppContext.tsx` | G | ✅ `AppContext.tsx:709-714` + `care-push/index.ts:153` |
| N8 | Alto | "Ver painel de cuidador" em Ajustes nunca aparece; Guia e tour citam caminho/aba inexistentes | `SettingsScreen.tsx`, `CareGuideScreen.tsx` | G | ✅ link removido de Ajustes; `CareGuideScreen.tsx:10-15`, `content.ts:506` |
| C1 | Crítico | "Preciso de você" some do painel quando pausado, carregando ou com erro | `CareScreen.tsx` | H | ✅ `CareScreen.tsx:325-328` (banner fora do ramo pausa/erro) |
| C2 | Crítico | "Preciso de você" enviado durante a pausa não chega a ninguém, mas a pessoa lê "seu cuidador vai saber" | migration `caregiver_presence`, `CaredPresence.tsx` | I + H | ⚠️ código ✅ (`care_ux.sql:509-521`, `care-push/index.ts:105-143`, `CaredPresence.tsx:42-53`), mas só vale depois de APLICAR a migration |
| C3 | Alto | Carinho recusado durante a pausa enquanto a interface oferece | `CarePresence.tsx` | H | ✅ `CarePresence.tsx:221-248` |
| C4 | Alto | Plano de cuidado: salvar nota/membro recarrega e apaga edições; campos limpos antes de salvar dar certo (Plano, Agenda) | `CarePlanScreen.tsx`, `AgendaScreen.tsx` | H | ✅ `CarePlanScreen.tsx:53,77-87,133`; `AgendaScreen.tsx:24,39-48,110` |
| C5 | Alto | Falha no polling de 60 s troca o painel inteiro por erro; erros se passam por estado vazio | `CareScreen.tsx`, `CareStates.tsx` | H | ✅ `CareScreen.tsx:36-106,334-348` (StaleNotice; erro por pessoa) |
| C6 | Alto | Encerrar vínculo (destrutivo) no alto do painel | `CareScreen.tsx` | H | ✅ `CareScreen.tsx:470-495` (zona de perigo + confirmação) |
| C7 | Alto | Agenda pede data em texto livre "AAAA-MM-DD HH:mm" | `AgendaScreen.tsx` | H | ✅ `AgendaScreen.tsx` + `CareDateTimeField.tsx` (seletor nativo) |
| C8 | Alto | Ajustes da pessoa só mostram o primeiro cuidador | `SettingsScreen.tsx` | H | ✅ `CareConnections.tsx:118-150` |
| C9 | Alto | Aceite do vínculo sem prévia do que é compartilhado e sem registro do termo (LGPD) | migration + `SettingsScreen.tsx` | I + H | ⚠️ código ✅ (`AcceptInviteScreen.tsx`, `care_ux.sql:448-503`); sem a migration cai no `accept_invite` sem registro do termo (`careUxClient.ts:232`) |
| C10 | Alto | Widget mostra título e detalhe do alerta na tela inicial | `AppContext.tsx` (sync do widget) | G | ✅ `widgetBridge.ts:125-134`, `CareScreen.tsx:178-183` (ver achado M1: widget não é limpo) |
| A1 | Crítico | Crise em 3ª pessoa ("falou em se matar", "não quer mais viver", "anda se cortando") não dispara resposta fixa | `api/services/crisis.py`, `app/src/chat/crisis.ts` | I | ✅ `api/services/crisis.py:13-39`, `app/src/chat/crisis.ts:15-36` (testes passam) |
| A2 | Alto | `top_emotion="unknown"` dá 422 e o copiloto cai calado nas respostas prontas | `api/routers/care.py`, `ChatScreen.tsx` | I | ✅ `api/routers/care.py:21-24,95` |
| A3 | Médio→Alto | Cuidador pode alterar qualquer coluna de `care_requests`; lê gestos após revogar; `accept_invite` não conta tentativas que falham | migrations de care | I | ✅ `care_ux.sql:525-559` (UPDATE só ack), `:565-575` (gestos), `:579-590` (auditoria); tentativas: `202610290001:9-56` |
| U1 | Crítico | Modo escuro: texto branco sobre primária com contraste 2,3:1 (`PrimaryButton`, ~40 `#fff`) | `components/ui.tsx`, tema | J | ✅ `palette.ts:42-44,67-68` (onPri); restam 2 `#fff` sobre vermelho (Baixo) |
| U2 | Crítico | Teclado cobre campos no Android (`ScreenScroll` não trata teclado) | `components/ScreenScroll.tsx` | J | ✅ `ScreenScroll.tsx:28` + `hooks/useKeyboardAwareScroll.ts` |
| U3 | Alto | `Touchable` sem papel acessível, sem área mínima de 44 px, `opacity` no style anula feedback | `components/ui.tsx` | J | ✅ `ui.tsx:154-190` (role, hitSlop 44, opacity composta) |
| U4 | Alto | `Toggle`, `Chip`, `Segmented`, `TabBar` sem papel/estado para leitor de tela | `components/` | J | ✅ `ui.tsx` (Toggle role switch, Chip/Segmented selected, tablist), `TabBar.tsx:65-67` |
| U5 | Alto | `T.t3` no tema claro com contraste 2,5:1; ~45 textos abaixo de 11 | tema | J | ✅ t3 corrigido (`palette.ts:38-41,64-65`); os 7 textos < 11 px apontados na verificação subiram para 11 (commit 56ba474) |
| U6 | Alto | Mensagens de sucesso/erro no topo de formulários longos (fora da vista) | várias telas do usuário | J (usuário) / H (cuidador) | ✅ `ActionMessage` junto do botão (Agenda, Plano, Notas, Conexões, Ajustes, Grupos) |
