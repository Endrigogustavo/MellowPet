# PR — endurecimento do motor de visão e qualidade do MellowPet

## Objetivo

Esta entrega reúne a varredura completa do repositório e as correções
automatizáveis para melhorar qualidade da detecção visual, latência percebida,
eficiência de processamento, segurança da telemetria e confiabilidade do
envio offline. O motor continua sendo um classificador de expressão visual;
ele não diagnostica o estado emocional interno da pessoa.

## Detecção de expressões

- Recalibração pessoal somente com frames neutros, estáveis e com qualidade
  mínima; a linha de base usa mediana para reduzir a influência de ruído.
- Ativação suave dos blendshapes, normalização pelo espaço restante e
  deadband para evitar amplificação de coeficientes baixos.
- Evidência bilateral com tolerância a assimetria natural do rosto.
- Combinação de sinais faciais complementares por classe e penalização de
  contradições, reduzindo classificações forçadas por um único coeficiente.
- Tratamento explícito de `neutral`, `unknown`, conflito persistente e perda
  de face.
- Histerese, votação temporal, margem mínima e entrada mais rápida após o
  primeiro frame elegível para reduzir trocas instáveis e atraso visual.
- Sinal de tensão separado da classe de expressão.
- Contadores nativos e métricas de qualidade/latência preservados para
  diagnóstico sem transportar pixels ou landmarks pela ponte JavaScript.

## Pipeline nativo

- Conversão Camera2 YUV → RGB direta, removendo o caminho intermediário
  YUV → JPEG → Bitmap.
- Fila de frames com `KEEP_ONLY_LATEST` e uma inferência nativa em voo.
- Reinicialização controlada da sessão quando o app volta do background,
  incluindo o caso de revogação da câmera em aparelhos com comportamento
  agressivo de gerenciamento de processos.
- Contratos Android, iOS e web atualizados para expor capacidades e manter
  fallback seguro quando o módulo nativo não está disponível.

## Fila offline e Supabase

- Substituição da fila limitada a 32 itens em SecureStore por SQLite local
  criptografado com SQLCipher.
- Chave aleatória de 256 bits guardada no SecureStore; o banco falha fechado
  se o build não incluir SQLCipher.
- Retenção automática de sete dias, WAL, índices por proprietário/tipo/idade
  e migração idempotente dos itens antigos.
- Itens antigos válidos só são removidos do SecureStore depois da confirmação
  da transação SQLite; itens ilegíveis permanecem preservados.
- A fila nunca envia um evento para uma conta diferente da sessão autenticada.
- Eventos são enviados antes dos feedbacks relacionados.
- Feedbacks sem proprietário são associados apenas depois de uma consulta
  autorizada ao `vision_intervals` do usuário ativo.
- Cursor de paginação para feedbacks legados, evitando que mais de 100 itens
  impeçam a progressão da fila.
- Lotes inválidos são divididos recursivamente para isolar registros com erro
  de constraint sem transformar uma falha de rede em várias requisições.
- Upload segue desligado por padrão pela flag
  `EXPO_PUBLIC_VISION_V2_EVENT_UPLOAD_ENABLED`.

A migration `202609170001_vision_telemetry.sql` foi aplicada no projeto
Supabase conectado e registrada remotamente como
`20260917143041 / 202609170001_vision_telemetry`. A aplicação confirmou que
os 8.004 intervalos existentes foram preservados. As tabelas de visão agora
usam RLS, leitura/inserção restritas a `authenticated` e filtros por
`auth.uid()`. O índice da chave estrangeira de `vision_feedback` também foi
confirmado.

## Backend, segurança e eficiência

- Validações da API e segurança reforçadas nos módulos de autenticação,
  dashboard e chat.
- Sanitização e limites de entrada documentados para evitar eco de dados,
  abuso de payload e exposição indevida.
- Configuração de container, ambiente e exemplos atualizada para execução
  previsível.
- Consultas e agregações do dashboard revisadas para evitar trabalho
  redundante e manter distinção entre ausência de dados e neutralidade.

## Testes e medições

- App: 48/48 testes passando.
- Backend: 22/22 testes passando em ambiente Python 3.12 novo.
- TypeScript: passando.
- ESLint: passando sem avisos.
- Expo Doctor: 18/18 verificações passando.
- Testes SQL em SQLite real: seleção por conta, dependência entre evento e
  feedback e paginação acima de 100 itens.
- Benchmark JS de 100.000 atualizações: p50 0,0152 ms, p95 0,0308 ms,
  p99 0,1489 ms e aproximadamente 46.897 atualizações/s nesta máquina.

O benchmark mede apenas scoring, suavização e decisão em JavaScript. Ele não
mede câmera, Camera2, conversão YUV, Face Landmarker, bridge React Native,
renderização ou latência total no aparelho.

## Validação no Supabase

Depois da migration, a auditoria remota deixou de apontar o índice ausente da
chave estrangeira de feedback. Permanecem avisos preexistentes fora do escopo
da telemetria: quatro funções `SECURITY DEFINER` expostas a usuários
autenticados, proteção contra senhas vazadas desativada e alguns avisos de
otimização RLS/índices não utilizados em tabelas do restante do produto.

## Limites que continuam explícitos

- Ainda é necessário um novo Development Build e teste em aparelho real para
  confirmar SQLCipher, Camera2, permissões, consumo, latência e comportamento
  de background.
- Ainda é necessário compilar/testar iOS.
- Ainda não há conjunto humano rotulado para medir macro-F1, matriz de
  confusão, cobertura seletiva, ECE e erro confiante por iluminação, pose e
  dispositivo.
- A flag de upload permanece desligada por padrão até validar uma sessão
  autenticada real no build.

## Como reproduzir as verificações

```powershell
cd app
npm ci
npm run doctor
npm run typecheck
npm run lint
npm run test:vision
npm run benchmark:vision -- 100000

cd ..\api
.\.venv\Scripts\python.exe -m pytest -q
```
