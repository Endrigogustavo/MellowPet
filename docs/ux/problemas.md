# Problemas — Fase 2

Detalhes, passo a passo e arquivo:linha de cada item:
- Navegação (Agente D): [problemas-navegacao.md](problemas-navegacao.md) — 21 itens, testes em `app/tests/nav_contract.test.mjs`.
- UX (Agente E): [problemas-ux.md](problemas-ux.md) — top 10, 14 padrões sistêmicos, tabelas por tela.
- API e banco (Agente F): [problemas-api.md](problemas-api.md) — testes em `api/tests/test_care_api_audit.py` (172 passam, 10 `xfail` = bugs documentados).

Esta lista consolida os **Críticos e Altos**, que são obrigatórios na Fase 4. Coluna "Dono" = agente da Fase 4. A coluna "Status" é preenchida pelo Agente K na Fase 5.

| # | Prior. | Problema | Arquivo principal | Dono | Status |
|---|---|---|---|---|---|
| N1 | Crítico | Sem guard por perfil: cuidador abre Home do pet e telas do usuário (widget, Chat, NowPlayingBar, notificações `water`/`ema`) | `navigation/RootNavigator.tsx`, `state/AppContext.tsx` | G | |
| N2 | Alto | Usuário abre telas de cuidador por notificação `care_*` | `state/AppContext.tsx` | G | |
| N3 | Alto | Destino pendente de notificação sobrevive ao logout e vale para a próxima conta | `state/AppContext.tsx` | G | |
| N4 | Alto | Onboarding e cadastro de cuidador: voltar físico pula o fluxo; "Voltar" da tela faz logout | `navigation/RootNavigator.tsx`, `CareSignupScreen.tsx` | G | |
| N5 | Alto | Widgets apontam para telas fora da lista aceita (`care`, `agenda`, `tools`, `settings`); `tool?action=` e `playlist?id=` ignorados | `state/AppContext.tsx` | G | |
| N6 | Alto | Voltar físico reabre editor de playlist após cancelar/salvar/excluir; Check-in ↔ Mapa emocional em ciclo; voltar na Home reabre o Guia | `PlaylistEditorScreen.tsx`, `CheckinScreen.tsx`, `AppContext.tsx` | G | |
| N7 | Alto | Notificação `care_alerts` abre a última pessoa selecionada, não quem gerou o alerta | `AppContext.tsx` | G | |
| N8 | Alto | "Ver painel de cuidador" em Ajustes nunca aparece; Guia e tour citam caminho/aba inexistentes | `SettingsScreen.tsx`, `CareGuideScreen.tsx` | G | |
| C1 | Crítico | "Preciso de você" some do painel quando pausado, carregando ou com erro | `CareScreen.tsx` | H | |
| C2 | Crítico | "Preciso de você" enviado durante a pausa não chega a ninguém, mas a pessoa lê "seu cuidador vai saber" | migration `caregiver_presence`, `CaredPresence.tsx` | I + H | |
| C3 | Alto | Carinho recusado durante a pausa enquanto a interface oferece | `CarePresence.tsx` | H | |
| C4 | Alto | Plano de cuidado: salvar nota/membro recarrega e apaga edições; campos limpos antes de salvar dar certo (Plano, Agenda) | `CarePlanScreen.tsx`, `AgendaScreen.tsx` | H | |
| C5 | Alto | Falha no polling de 60 s troca o painel inteiro por erro; erros se passam por estado vazio | `CareScreen.tsx`, `CareStates.tsx` | H | |
| C6 | Alto | Encerrar vínculo (destrutivo) no alto do painel | `CareScreen.tsx` | H | |
| C7 | Alto | Agenda pede data em texto livre "AAAA-MM-DD HH:mm" | `AgendaScreen.tsx` | H | |
| C8 | Alto | Ajustes da pessoa só mostram o primeiro cuidador | `SettingsScreen.tsx` | H | |
| C9 | Alto | Aceite do vínculo sem prévia do que é compartilhado e sem registro do termo (LGPD) | migration + `SettingsScreen.tsx` | I + H | |
| C10 | Alto | Widget mostra título e detalhe do alerta na tela inicial | `AppContext.tsx` (sync do widget) | G | |
| A1 | Crítico | Crise em 3ª pessoa ("falou em se matar", "não quer mais viver", "anda se cortando") não dispara resposta fixa | `api/services/crisis.py`, `app/src/chat/crisis.ts` | I | |
| A2 | Alto | `top_emotion="unknown"` dá 422 e o copiloto cai calado nas respostas prontas | `api/routers/care.py`, `ChatScreen.tsx` | I | |
| A3 | Médio→Alto | Cuidador pode alterar qualquer coluna de `care_requests`; lê gestos após revogar; `accept_invite` não conta tentativas que falham | migrations de care | I | |
| U1 | Crítico | Modo escuro: texto branco sobre primária com contraste 2,3:1 (`PrimaryButton`, ~40 `#fff`) | `components/ui.tsx`, tema | J | |
| U2 | Crítico | Teclado cobre campos no Android (`ScreenScroll` não trata teclado) | `components/ScreenScroll.tsx` | J | |
| U3 | Alto | `Touchable` sem papel acessível, sem área mínima de 44 px, `opacity` no style anula feedback | `components/ui.tsx` | J | |
| U4 | Alto | `Toggle`, `Chip`, `Segmented`, `TabBar` sem papel/estado para leitor de tela | `components/` | J | |
| U5 | Alto | `T.t3` no tema claro com contraste 2,5:1; ~45 textos abaixo de 11 | tema | J | |
| U6 | Alto | Mensagens de sucesso/erro no topo de formulários longos (fora da vista) | várias telas do usuário | J (usuário) / H (cuidador) | |
