# Diagnóstico consolidado — Fase 1

Fontes detalhadas: [navegacao-atual.md](navegacao-atual.md) (Agente A), [diag-cuidador.md](diag-cuidador.md) (Agente B), [diag-api.md](diag-api.md) (Agente C).

## Correção do briefing
O briefing descreve SQLite, DeepFace e APIs da Anthropic/OpenAI. O projeto real é:
- **App:** Expo SDK 54 / React Native / TypeScript (`app/`), navegação **própria** (sem expo-router nem React Navigation): `state.screen` + `history` no reducer de `app/src/state/AppContext.tsx`, mapa de telas em `app/src/navigation/RootNavigator.tsx`.
- **Dados:** Supabase (Postgres + RLS + RPCs), migrations em `supabase/migrations/`. O app fala direto com o Supabase. `api/mellowpet.db` é sobra antiga, ninguém importa.
- **API:** FastAPI no Render, só para IA (Gemini com fallbacks). O único endpoint de cuidador é `POST /api/v1/care/chat`.

As migrations deste trabalho são Postgres/Supabase, não SQLite, e seguem a mesma regra: só aditivas.

## Navegação (A)
- 35 telas, um guard só de autenticação (`PUBLIC_SCREENS`). **Não há guard por perfil**: o perfil escolhe a tela inicial, as abas e o componente de `dashboard`.
- Widgets mandam para `care`, `agenda`, `tools`, `settings`, que não estão na lista de destinos aceitos; `tool?action=` e `playlist?id=` não são tratados.
- Cuidador alcança telas do usuário (ações do Chat, widgets, notificações `water`/`ema`, barra de música). Usuário alcança telas do cuidador por notificação `care_*`.
- "Voltar" do título e voltar físico divergem. Parâmetros implícitos no estado global (`openPlaylistId`, `state.person`).

## Área do cuidador (B)
- Dados reais, sem mocks. Consentimento tudo ou nada; a pessoa pausa (24 h / 7 d) e revoga.
- **Parcial:** painel de várias pessoas (só a selecionada carrega), histórico (14 dias, sem semana/mês, dia em UTC), anotações (sem dia, sem editar/apagar), resumo semanal (por regras, sem IA), estados vazios (falta status do convite).
- **Não existe:** regras de alerta configuráveis, preferências de notificação, tela da pessoa acompanhada para ver plano/compromissos do cuidador.
- **Quebras:** "Preciso de você" durante a pausa some; carinho recusado durante a pausa enquanto a interface oferece.
- **LGPD:** aceite sem prévia do que é compartilhado e sem registro do termo; widget mostra título/detalhe do alerta; trilha de auditoria legível por outros cuidadores.

## Backend (C)
- 23 rotas em `/api/v1`, todas com `X-API-Key`; as de IA aceitam JWT Supabase opcional e cota por usuário.
- Acesso do cuidador concentrado em `private.care_link_for` / `care_scope_enabled`: exigem vínculo aceito, não revogado, não expirado, não pausado. Revogar e pausar cortam o acesso na hora.
- `care_dashboard_summary` dá buckets por hora e dia (até 90 dias), sem semana/mês, em UTC.
- Faltam: coluna de dia nas notas, preferências de push, regras configuráveis, agregado semanal/mensal em data local, resumo semanal por IA.
- `caregiver_links`, `emotion_events` e `profiles` não estão versionados no repositório (schema base aplicado à mão).
