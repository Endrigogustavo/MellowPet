# Schema do Supabase

O banco, a autenticação e o realtime do MellowPet ficam no Supabase — a API
em Python só existe para o que exige chave secreta de provedor de IA.

## O que já está aplicado no projeto

Estas tabelas já existem e estão em uso (verificado via REST):

| Tabela | Usada por |
|---|---|
| `profiles` | perfil, XP/nível, contadores de cuidado |
| `emotion_events` | histórico emocional, dashboard, painel do cuidador |
| `routine_items` | tela Rotina + lembretes locais |
| `caregiver_links` | vínculo entre usuário e cuidador |
| `journal_entries` | diário |
| `user_settings` | preferências |
| `vision_intervals`, `vision_feedback` | telemetria agregada do motor de visão |

Funções: `bump_profile(fed_delta, played_delta, xp_delta)` e `accept_invite`.

## Migrations do módulo de cuidador

As migrations `202608280001` a `202608290011` versionam RLS dos artefatos de
cuidado, alertas, agenda, plano, equipe, notas, auditoria, índices e a RPC
agregada usada pelos dashboards do cuidador. A última migration torna o acesso
integral e automático para todo vínculo de cuidador aceito; o consentimento
granular anterior fica somente como histórico interno. Aplique-as em ordem. Veja também
[`../docs/caregiver-module.md`](../docs/caregiver-module.md).

## Segurança operacional

No Dashboard do Supabase, em **Authentication → Providers → Email**, habilite
**Leaked password protection** antes da publicação (recurso disponível no plano
Pro ou superior). Essa configuração é global do Auth e não é alterada pelas
migrations; ela impede o uso de senhas já expostas em vazamentos conhecidos.

## Outros itens a aplicar

[`playlists.sql`](playlists.sql) — playlists de momento criadas pelo usuário.
**Sem isso, a tela "Criar playlist" falha ao salvar.**

Como aplicar: painel do Supabase → SQL Editor → cole o conteúdo do arquivo →
Run. É idempotente (`create table if not exists`, `drop policy if exists`),
então rodar duas vezes não quebra nada.

## Por que as faixas ficam aqui e não só no Spotify

A playlist continua existindo se a pessoa desconectar o Spotify, e faixas
locais em domínio público podem se misturar com as do Spotify na mesma lista.
Quando a pessoa está com a conta conectada, a playlist também é espelhada na
conta dela (campo `spotify_uri`) — mas o espelho é bônus, não requisito.
