# MellowPet — Motor de Expressões Faciais V2

**Status:** proposta pronta para refinamento e execução
**Versão:** 1.0
**Data:** 21 de agosto de 2026
**Escopo:** aplicativo Expo/React Native, motor de visão computacional e API FastAPI
**Decisão principal:** processamento `edge-first`, com inferência em tempo real no aparelho e envio de eventos agregados para a API

## 1. Resumo executivo

O MellowPet deve substituir o fluxo atual de fotos em Base64 enviadas continuamente à API por um pipeline de vídeo processado no próprio aparelho. O aparelho extrai landmarks/blendshapes, avalia a qualidade do sinal, classifica a expressão e estabiliza o resultado ao longo do tempo. A API deixa de participar do caminho crítico e recebe somente transições e resumos de expressão, sem imagens por padrão.

A V2 também muda a semântica do produto: a visão computacional informa uma **expressão facial observada**, não afirma o estado emocional ou clínico da pessoa. Estados como “ansioso” ficam restritos a autorrelato, sinais contextuais e linguagem de apoio. Quando não há rosto ou a imagem não é confiável, o resultado passa a ser `unknown`/“sinal insuficiente”, nunca `neutral`.

O modelo FER+ atual continua como baseline de avaliação durante a migração. Um novo modelo só entra em produção se vencer o baseline em um conjunto congelado, separado por pessoa, além de cumprir metas de latência, calibração, consumo e equidade. Microexpressões e rPPG deixam o fluxo de produção e seguem, se houver interesse, como trilhas de pesquisa separadas.

## 2. Respostas recomendadas

| Pergunta de produto/engenharia | Resposta recomendada | Motivo |
|---|---|---|
| Onde executar a inferência? | No aparelho. | Reduz latência, custo, dependência de rede e exposição de imagens. |
| Imagens devem sair do aparelho? | Não, por padrão. | O backend precisa do evento, não do frame. Captura para avaliação exige consentimento específico e temporário. |
| Manter o endpoint de frames? | Apenas como fallback de migração, atrás de feature flag e com prazo para remoção. | Evita uma troca abrupta e permite comparar V1 e V2. |
| Usar fotos periódicas ou vídeo? | Frames do fluxo de vídeo, com processamento assíncrono e `latest-frame-wins`. | Evita custo de JPEG/Base64 e filas de frames antigos. |
| Qual cadência usar? | Captura a 30 fps; landmarks a 10–15 fps; classificador de pixels a 3–5 fps; UI a no máximo 4 Hz. | Mantém responsividade sem processar dados redundantes. |
| Qual tecnologia no app? | Expo Development Build, módulo nativo/config plugin e Face Landmarker em modo live stream; migrar o app de SDK 54 para SDK 57 antes da integração. | O pipeline requer acesso nativo contínuo e respeita a orientação versionada já definida pelo projeto. |
| Trocar o FER+ imediatamente? | Não. Mantê-lo como baseline e comparar candidatos quantizados por dados. | Trocar sem benchmark apenas muda o tipo de erro. |
| “Ansioso” é uma classe facial? | Não. | Ansiedade não é observável de forma específica em uma única face. Usar `tension_signal` e confirmação do usuário. |
| O que retornar sem rosto ou com frame ruim? | `unknown`, acompanhado da causa de qualidade. | `neutral` é uma expressão válida, não um fallback técnico. |
| Como apresentar `confidence`? | “Confiança do sinal”, nunca “precisão”. | Confiança de uma predição não é a precisão do sistema. |
| Como calibrar por pessoa? | Sessão explícita de rosto em repouso, com qualidade aprovada, ou amostras confirmadas pelo usuário. | Os primeiros frames não podem ser presumidos como neutros. |
| Como suavizar o resultado? | Uma única máquina temporal local, sensível à qualidade, com EMA, margem e histerese. | Evita oscilações e dupla suavização cliente/servidor. |
| WebSocket é necessário? | Não para a V2. Usar REST em lote para eventos. | A inferência local não depende da rede; REST é mais simples e suficiente. |
| O que armazenar? | Intervalos/transições, distribuição, qualidade, versão do modelo e feedback. | Armazenar cada frame aumenta custo e distorce histórico. |
| Como usar o feedback “acertei?” | Como dado de avaliação e correção, sem retreino online automático. | Evita degradação silenciosa e envenenamento do modelo. |
| rPPG deve alterar a emoção? | Não. Retirar da fusão de produção. | A implementação atual não tem cadência nem validação fisiológica suficientes. |
| Detectar microexpressões agora? | Não. Remover da promessa de produção. | O fluxo atual de 500–1000 ms não captura eventos rápidos de forma defensável. |
| Quando disparar alertas? | Somente após sinal persistente, boa cobertura de qualidade e consentimento; nunca por um frame. | Diminui falsos alertas e linguagem indevidamente diagnóstica. |
| É possível monitorar “invisivelmente” em segundo plano? | Não é requisito da V2. A câmera funciona apenas em sessão visível e explicitamente ativa. | É coerente com privacidade e restrições das plataformas móveis. |
| O que bloqueia produção? | Ausência de autenticação real, isolamento de conta, benchmark congelado, telemetria e fluxo de consentimento. | São controles mínimos para histórico e compartilhamento com cuidador. |

## 3. Contexto confirmado no repositório

### 3.1 Aplicativo atual

- O aplicativo em `app/` usa Expo SDK 54, React Native 0.81 e Context/Reducer próprio.
- A experiência e as features de MellowPet já estão representadas: pet reativo, ferramentas de apoio, respiração, música, chat, diário, rotinas, dashboard, alertas e modo cuidador.
- A emoção mostrada na UI ainda é simulada: `AppContext.tsx` avança pelo catálogo a cada oito segundos.
- O catálogo da UI contém `anxious`, mas não contém `fearful`; o backend pode retornar `fearful`.
- Os dados exibidos como confiança, qualidade e BPM são estáticos no catálogo de emoções.
- O feedback positivo/negativo altera apenas o estado local e não gera evento útil para avaliação.

### 3.2 Backend atual

O backend FastAPI implementa este fluxo:

```text
JPEG/PNG Base64
  -> decode
  -> MediaPipe Face Landmarker em IMAGE
  -> landmarks/blendshapes -> Action Units
  -> calibração de baseline
  -> regras AU -> scores
  -> FER+ ONNX no recorte facial
  -> fusão
  -> ajuste por rPPG
  -> votação/suavização temporal
  -> persistência de cada leitura em SQLite
```

Pontos positivos que devem ser preservados:

- separação modular entre landmarks, Action Units, classificador, fusão, qualidade e temporal;
- combinação de geometria e pixels;
- estado temporal por sessão;
- existência de testes unitários e de um script de verificação de precisão;
- campos de versão e qualidade podem ser adicionados sem redesenhar todo o produto.

Problemas que a V2 precisa resolver:

- Base64, JPEG e rede estão no caminho crítico de cada leitura;
- inferência pesada e síncrona é chamada por endpoint assíncrono;
- locks dos modelos serializam o processamento no servidor;
- cada frame é persistido, inclusive ausência de rosto tratada como `neutral`;
- métricas detalhadas de qualidade são calculadas tarde demais para proteger a classificação;
- o fallback por rotação aumenta a pior latência e pode desalinha coordenadas do recorte;
- baseline persistente está implementado, mas seu salvamento não está ligado ao fluxo principal;
- o motor temporal tem um erro reproduzível no script de precisão: variáveis de variante/zona/dica podem ser usadas antes de serem inicializadas;
- o classificador FER+ não possui benchmark local congelado, matriz de confusão, análise por fatia ou calibração documentada;
- rPPG usa poucas amostras e cadência incompatível com a banda cardíaca que pretende estimar;
- a linguagem da UI pode transformar inferência probabilística em afirmação emocional ou fisiológica;
- a política de privacidade mostrada pelo produto precisa refletir o transporte real de dados.

## 4. Objetivos

### 4.1 Objetivos de produto

1. Fazer o pet reagir de forma perceptivelmente mais rápida e estável.
2. Reduzir falsos positivos em baixa luz, rosto parcial, movimento e pose lateral.
3. Evitar apresentar ausência de evidência como neutralidade.
4. Tornar a interação de feedback útil para medir e melhorar o sistema.
5. Preservar privacidade: nenhuma imagem deixa o aparelho no funcionamento normal.
6. Usar linguagem de apoio, não diagnóstica, com transparência sobre incerteza.

### 4.2 Objetivos técnicos

1. Retirar rede, JPEG, Base64 e gravação no banco do caminho crítico da inferência.
2. Processar somente o frame mais recente disponível, sem backlog.
3. Criar um contrato V2 compartilhado entre app e API.
4. Estabelecer benchmark reprodutível, separado por pessoa e com relatórios por fatia.
5. Tornar modelo, thresholds, qualidade e fusão versionados e substituíveis.
6. Observar latência, cobertura, abstinção, erro confiante, consumo e estabilidade.

## 5. Não objetivos

- diagnosticar ansiedade, depressão, crise, risco clínico ou qualquer condição de saúde;
- afirmar que uma expressão facial revela, sozinha, a emoção interna da pessoa;
- capturar câmera escondida ou continuamente em segundo plano;
- armazenar fotos ou vídeo no fluxo normal;
- detectar microexpressões na primeira entrega;
- usar rPPG para classificar expressão ou acionar alertas;
- retreinar ou alterar pesos do modelo diretamente com um único feedback;
- resolver, nesta spec, o conteúdo completo do chat de IA, planos, cobrança ou integrações musicais.

## 6. Linguagem e modelo de domínio

### 6.1 Separação obrigatória

```text
expressão observada pela câmera  !=  estado sentido pela pessoa  !=  condição clínica
```

- **Expressão observada:** saída probabilística do motor visual.
- **Sinal de tensão:** combinação não diagnóstica de movimentos como testa contraída e lábios pressionados; pode motivar uma pergunta.
- **Estado relatado:** resposta escolhida ou escrita pela pessoa.
- **Necessidade de apoio:** regra de produto baseada em persistência, contexto, preferências e consentimento — não em um frame isolado.

### 6.2 Taxonomia visual V2

```ts
type ObservedExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'disgusted'
  | 'fearful'
  | 'unknown';
```

Regras:

- `unknown` é abstinção técnica e não participa de “emoção dominante”.
- `anxious` não é saída do classificador visual.
- A UI pode traduzir `disgusted` como “incômodo” e `fearful` como “sinais de receio”, deixando claro que é uma leitura facial.
- `neutral` só é emitido quando o classificador recebeu sinal aceito e realmente escolheu neutralidade.
- Todo score é uma probabilidade calibrada de classe visual, não probabilidade de a pessoa “estar sentindo” aquilo.

### 6.3 Estados auxiliares

```ts
type SignalStatus =
  | 'ready'
  | 'no_face'
  | 'insufficient_quality'
  | 'warming_up'
  | 'permission_denied'
  | 'camera_unavailable';

type QualityReason =
  | 'face_too_small'
  | 'pose_out_of_range'
  | 'too_dark'
  | 'overexposed'
  | 'blurred'
  | 'occluded'
  | 'unstable_tracking';
```

## 7. Arquitetura-alvo

```text
┌──────────────────────────── APLICATIVO ────────────────────────────┐
│ Camera preview (sessão visível)                                    │
│       │                                                            │
│       ▼  frames nativos + timestamp monotônico                     │
│ Native Vision Worker                                               │
│       ├─ Face Landmarker LIVE_STREAM (10–15 fps adaptativos)       │
│       ├─ quality gate                                               │
│       ├─ blendshapes/AUs + calibração local                         │
│       ├─ classificador quantizado de pixels (3–5 fps)              │
│       ├─ fusão calibrada                                            │
│       └─ temporal + histerese                                       │
│               │                                                    │
│               ├─ estado local -> UI/pet (≤ 4 Hz)                   │
│               └─ transição/heartbeat -> fila local criptografada   │
└───────────────────────────┬────────────────────────────────────────┘
                            │ REST batch, fora do caminho crítico
                            ▼
┌────────────────────────────── API V2 ───────────────────────────────┐
│ autenticação -> validação/idempotência -> eventos/intervalos       │
│                         ├─ dashboard                                │
│                         ├─ regras de apoio/alerta                    │
│                         └─ feedback e métricas agregadas            │
└─────────────────────────────────────────────────────────────────────┘

                Laboratório separado de avaliação
     dataset consentido/público -> replay -> modelos candidatos
       -> acurácia/calibração/latência/equidade -> promoção assinada
```

### 7.1 Fronteiras de responsabilidade

**Aplicativo**

- pedir permissão e explicar uso da câmera antes de iniciar;
- iniciar/parar a sessão junto com o ciclo visível da tela;
- executar captura, qualidade, inferência e temporal;
- atualizar o pet sem esperar rede;
- armazenar uma fila pequena de eventos e sincronizar com retry/idempotência;
- apagar buffers de imagem assim que cada inferência termina.

**API**

- autenticar usuário e vínculo de cuidador;
- aceitar eventos idempotentes em lote;
- consolidar intervalos, tendências e feedback;
- executar regras de apoio que não estejam no caminho de renderização;
- impedir leitura cruzada entre contas;
- expor versões compatíveis e política de retenção.

**Laboratório Python**

- manter o pipeline atual como baseline reproduzível;
- executar replay offline e produzir relatórios;
- treinar/calibrar/quantizar candidatos;
- validar o artefato móvel antes de promovê-lo.

## 8. Requisitos funcionais

### FR-01 — Consentimento e sessão de câmera

- A câmera só inicia após uma explicação curta e uma ação afirmativa.
- A sessão deve exibir indicador persistente de câmera ativa e comando de pausa.
- A captura é encerrada ao sair da tela, bloquear o aparelho, perder foco ou ir para background.
- Negar permissão mantém todas as features manuais disponíveis.
- O texto de privacidade deve dizer corretamente se eventos agregados são sincronizados.

### FR-02 — Captura contínua sem backlog

- A fonte preferida é o frame do vídeo, não `takePictureAsync` repetido.
- O worker possui fila máxima de um frame: ao chegar um novo frame, o antigo não iniciado é descartado.
- Cada frame processado carrega timestamp monotônico.
- Rotação, espelhamento e orientação devem ser normalizados uma única vez; landmarks e recorte precisam usar o mesmo sistema de coordenadas.
- A resolução de inferência deve ser configurável; valor inicial recomendado: lado curto entre 256 e 360 px, validado por dispositivo.

### FR-03 — Rastreamento e qualidade antes da classe

- Face Landmarker deve operar em `LIVE_STREAM`/equivalente nativo.
- Tracking deve evitar rodar detecção completa em todos os frames.
- O quality gate avalia presença, tamanho relativo, yaw, pitch, iluminação, contraste, nitidez, movimento e oclusão.
- Um frame reprovado não é enviado ao classificador e produz status/causa de qualidade.
- Thresholds são configuração versionada, não números espalhados em código.
- Valores iniciais de pose para o spike: `|yaw| ≤ 35°` e `|pitch| ≤ 25°`; a avaliação P1 determina os valores finais.

### FR-04 — Extração de características

- Blendshapes nativos são a fonte primária de geometria.
- A camada de Action Units é uma transformação versionada e testável, sem alegar equivalência clínica perfeita com FACS.
- Features são normalizadas pela calibração local quando ela existe.
- Features por frame não são enviadas ao servidor por padrão; somente agregados necessários à explicabilidade podem ser incluídos no evento.

### FR-05 — Classificador de pixels substituível

- Definir interface `ExpressionClassifier` com entrada, distribuição, versão e tempo de inferência.
- FER+ é o `baseline_legacy`; não é promovido automaticamente ao aparelho.
- Candidatos devem suportar execução móvel quantizada via ONNX Runtime Mobile ou alternativa equivalente comprovada no spike.
- O artefato precisa incluir: hash, versão do dataset, versão do preprocessing, quantização, classes e parâmetros de calibração.
- Falha no classificador de pixels degrada para geometria + maior abstinção; não derruba a sessão.

### FR-06 — Fusão calibrada

- Distribuições dos canais são calibradas antes da fusão.
- Pesos dependem da qualidade específica de cada canal.
- Discordância grande aumenta chance de `unknown`; não deve ser mascarada por confiança artificial.
- A fusão deve ser determinística para o mesmo conjunto de entradas e configuração.
- Toda promoção de regra ou peso exige comparação no conjunto congelado.

### FR-07 — Estabilização temporal

- Existe apenas uma estabilização autoritativa: no aparelho.
- Usar EMA sensível ao intervalo real entre timestamps, não à quantidade presumida de frames.
- Aplicar histerese, margem entre as duas maiores classes e tempo mínimo de confirmação.
- Configuração inicial para experimento:
  - meia-vida da EMA: 300 ms;
  - entrada: score ≥ 0,55, margem ≥ 0,15 e três atualizações aceitas;
  - saída: score < 0,42 ou concorrente confirmado;
  - perda de qualidade por 500 ms: manter último estado somente como visual, marcado `stale`;
  - perda prolongada: `unknown`/`no_face`.
- Esses valores são sementes de configuração; P1/P4 precisam ajustá-los por curva de erro versus atraso.

### FR-08 — Calibração pessoal

- Calibração é opcional, explicada e refeita sob comando do usuário.
- Fluxo recomendado: 8–10 segundos olhando naturalmente para a câmera, somente com frames aprovados.
- Alternativa incremental: usar apenas amostras que o usuário confirmou como neutras.
- Nunca inferir baseline neutro a partir dos primeiros N frames sem confirmação.
- Baseline fica local e é invalidado quando versão de features/modelo muda.

### FR-09 — Resultado local

```ts
type LocalExpressionResultV2 = {
  observedExpression: ObservedExpression;
  distribution: Record<Exclude<ObservedExpression, 'unknown'>, number>;
  signalConfidence: number;       // 0..1, calibrado
  signalStatus: SignalStatus;
  qualityScore: number;           // 0..1
  qualityReasons: QualityReason[];
  tensionSignal: number | null;   // não diagnóstico
  stableSinceMs: number | null;
  isStale: boolean;
  modelVersion: string;
  pipelineVersion: string;
  capturedAtMs: number;
  computedAtMs: number;
};
```

- A UI usa `observedExpression` somente quando `signalStatus === 'ready'`.
- “Confiança do sinal” só é exibida se houver explicação acessível ao usuário.
- BPM deixa de ser apresentado como saída da detecção facial V2.
- Mensagens devem usar “parece haver sinais de...” e oferecer confirmação, não declarar “você está...”.

### FR-10 — Feedback

- Pergunta recomendada: “Essa leitura combinou com o que você percebeu agora?”
- Respostas: `sim`, `não`, `não tenho certeza`.
- Em `não`, oferecer correção opcional entre estado autorrelatado, “nenhuma dessas” e texto livre; não obrigar o usuário a escolher uma classe facial.
- Evento de feedback inclui resultado, distribuição, qualidade e versões, sem imagem.
- Feedback alimenta relatórios offline e, após agregação, possível atualização de thresholds/modelo com revisão e rollback.

### FR-11 — Alertas e apoio

- Nenhum alerta a cuidador ou recomendação urgente pode ser disparado por um único frame.
- Regra inicial de “oferecer apoio” no próprio aparelho:
  - sinal visual aceito e persistente por pelo menos 120 s;
  - cobertura de frames com qualidade ≥ 70% na janela;
  - confiança média calibrada ≥ 0,70;
  - cooldown mínimo de 15 min;
  - confirmação do usuário sempre que possível.
- O alerta externo exige vínculo autenticado, consentimento explícito e regra habilitada pelo usuário.
- O texto externo deve descrever “sinais persistentes que podem indicar necessidade de apoio”, com horário e opção de contato; não deve nomear diagnóstico.
- Emergência nunca é inferida ou acionada exclusivamente pela câmera.
- Alerta de ausência de rosto só existe dentro de uma sessão de monitoramento explicitamente ativa e usa o período configurado pelo usuário.

### FR-12 — Operação offline

- Inferência e reação do pet funcionam sem rede.
- Eventos ficam em fila local limitada, com retry exponencial e identificador idempotente.
- Ao exceder o limite, consolidar heartbeats antigos; nunca acumular frames.
- Sincronização não pode bloquear a câmera ou a UI.

## 9. Frequência e orçamento de processamento

| Estágio | Frequência inicial | Regra adaptativa |
|---|---:|---|
| Câmera | 30 fps | Pode reduzir com economia de energia/plataforma. |
| Face Landmarker | 10–15 fps | Reduzir para 5–8 fps em aquecimento; aumentar durante mudança/movimento. |
| Quality gate | Em todo resultado do landmarker | Custo deve permanecer pequeno. |
| Classificador de pixels | 3–5 fps | Rodar mais cedo em transições ou discordância; menos em estado estável. |
| Fusão/temporal | Em todo resultado aceito | Baseado em timestamp. |
| Atualização visual | Máximo 4 Hz | Mudança confirmada pode atualizar imediatamente. |
| Heartbeat para API | A cada 15–30 s | Transições confirmadas são enviadas antes. |

O scheduler deve priorizar, nesta ordem: preview fluido, resposta local recente, temperatura/energia e só então quantidade de inferências. Frame antigo não tem valor para interação em tempo real.

## 10. Contrato de eventos V2

### 10.1 Princípios

- endpoint versionado;
- autenticação obrigatória;
- evento idempotente por `event_id`;
- timestamps UTC e duração monotônica calculada no cliente;
- schema gerado do OpenAPI e consumido pelo TypeScript;
- nenhuma imagem, crop facial, landmark bruto ou Base64 no contrato normal;
- versões completas permitem reproduzir a decisão.

### 10.2 Evento recomendado

`POST /v2/expression-events:batch`

```json
{
  "session_id": "01J...",
  "device_session_id": "01J...",
  "events": [
    {
      "event_id": "01J...",
      "kind": "transition",
      "started_at": "2026-08-21T13:10:02.431Z",
      "ended_at": "2026-08-21T13:10:18.005Z",
      "observed_expression": "sad",
      "expression_distribution": {
        "neutral": 0.08,
        "happy": 0.02,
        "sad": 0.74,
        "angry": 0.04,
        "surprised": 0.01,
        "disgusted": 0.03,
        "fearful": 0.08
      },
      "signal_confidence": 0.74,
      "quality": {
        "mean": 0.82,
        "accepted_coverage": 0.91,
        "reasons": []
      },
      "tension_signal": 0.31,
      "model_version": "expression-mobile@2.0.0",
      "pipeline_version": "vision-pipeline@2.0.0",
      "quality_config_version": "quality@1.0.0",
      "calibration_version": "personal-baseline@1",
      "source": "mobile"
    }
  ]
}
```

Resposta:

```json
{
  "accepted_event_ids": ["01J..."],
  "duplicate_event_ids": [],
  "rejected": [],
  "server_time": "2026-08-21T13:10:19.010Z"
}
```

### 10.3 Feedback recomendado

`POST /v2/expression-feedback`

```json
{
  "feedback_id": "01J...",
  "event_id": "01J...",
  "agreement": "no",
  "self_reported_state": "anxious",
  "corrected_observed_expression": null,
  "note": null,
  "created_at": "2026-08-21T13:10:25.000Z"
}
```

`self_reported_state` e `corrected_observed_expression` são campos diferentes de propósito. O primeiro descreve a pessoa; o segundo, quando preenchido por avaliação qualificada, corrige a leitura visual.

### 10.4 Migração do contrato V1

- Manter `POST /emotion/analyze` somente para shadow/fallback durante P2–P4.
- Marcar respostas V1 com `pipeline_version=legacy-server`.
- Não misturar eventos V1 e V2 sem guardar a origem.
- Dashboard deve ignorar leituras `face_detected=false` do legado ou migrá-las para `unknown`.
- Remover o endpoint de frames após duas versões estáveis da V2 e confirmação de rollback independente.

## 11. Persistência e privacidade

### 11.1 Dados normais de produção

Armazenar:

- evento/intervalo de expressão observada;
- distribuição agregada e confiança calibrada;
- resumo de qualidade;
- versões de pipeline/modelo/configuração;
- feedback e estado autorrelatado, quando fornecidos;
- trilha de consentimento e vínculo do cuidador.

Não armazenar:

- imagem completa ou recorte facial;
- vídeo;
- landmarks por frame;
- buffer rPPG;
- logs com payload, Base64 ou identificador pessoal desnecessário.

### 11.2 Avaliação consentida

Se for necessário coletar amostras reais:

- fluxo separado, opt-in e revogável;
- finalidade, acesso e retenção informados antes da captura;
- desabilitado por padrão em produção;
- criptografia em trânsito e repouso;
- retenção recomendada de no máximo 24 horas na área de entrada; depois disso, transferir somente amostras aprovadas para um dataset controlado com retenção própria, ou excluir;
- acesso auditado e limitado à equipe de avaliação;
- exportação e exclusão disponíveis;
- revisão jurídica e de privacidade antes de habilitar.

### 11.3 Identidade e autorização

A chave de API compartilhada não é autenticação de usuário. Antes de histórico, cuidador e alertas em produção, a V2 exige:

- sessão autenticada com tokens curtos/renováveis;
- autorização por recurso e isolamento por conta;
- convite e revogação do vínculo de cuidador;
- rate limit por conta/dispositivo;
- trilha de auditoria para leitura e envio de alerta;
- segredos fora do bundle e rotação suportada.

## 12. Estratégia de modelo e dados

### 12.1 Baseline

Congelar a V1 atual com:

- commit e hashes dos modelos;
- preprocessing exato;
- thresholds e pesos;
- matriz de confusão;
- macro-F1, balanced accuracy, cobertura, ECE e latência;
- falhas conhecidas por luz, pose e dispositivo.

O erro de `temporal.py` deve ser corrigido antes de medir o baseline, sem alterar a regra esperada.

### 12.2 Conjunto de avaliação

- Combinar dataset público licenciado com clips internos consentidos que representem o uso do MellowPet.
- Fazer divisão por pessoa, nunca por frame, para impedir vazamento de identidade entre treino e teste.
- Congelar um holdout que não participa de ajuste de thresholds.
- Incluir explicitamente `unknown` e exemplos difíceis: sem rosto, rosto parcial, óculos, máscara, baixa luz, contraluz, movimento, pose, múltiplos rostos e imagens de tela/foto.
- Rotular expressão observável separadamente de autorrelato.
- Dupla anotação nos casos internos e adjudicação de desacordos.
- Reportar quantidade e incerteza; não ocultar classe pequena em média global.

### 12.3 Fatias obrigatórias

- tier do aparelho e sistema operacional;
- ambiente interno/externo e níveis de iluminação;
- frontal versus faixas de yaw/pitch;
- óculos, barba e oclusão, quando presentes;
- tons de pele, faixas etárias e gênero somente quando consentidos e com tamanho suficiente;
- pessoa conhecida versus nunca vista no treino;
- com e sem calibração pessoal.

### 12.4 Promoção de candidato

Um candidato só substitui o baseline se, no holdout congelado:

1. aumentar macro-F1 em pelo menos **5 pontos percentuais absolutos**;
2. a margem inferior do intervalo de confiança bootstrap de 95% da melhoria for maior que zero;
3. nenhuma classe perder mais de 3 pontos percentuais de recall sem decisão documentada;
4. atingir `ECE ≤ 0,08` ou reduzir ECE em pelo menos 25% contra o baseline;
5. atingir macro-F1 seletivo `≥ 0,78` com cobertura `≥ 70%`, medindo abstinção;
6. manter erro confiante — predição errada com confiança `≥ 0,80` — `≤ 5%`;
7. cumprir os budgets móveis da seção 13;
8. não apresentar diferença superior a 10 pontos percentuais entre melhores e piores fatias críticas sem mitigação, documentação e aceite explícito.

Se o baseline inicial já for pior do que o necessário para tornar essas metas viáveis, P1 deve registrar o valor e P4 pode propor um gate revisado; o gate nunca pode ser reduzido silenciosamente.

### 12.5 Calibração probabilística

- Aplicar temperature scaling ou método equivalente em validação separada.
- Medir reliability diagram, ECE e Brier score.
- Calibrar novamente após quantização.
- `signal_confidence` exposto ao produto vem do pipeline calibrado após fusão/temporal, não do softmax bruto.

## 13. Requisitos não funcionais e SLOs

Medir em aparelhos reais, com build de release e telemetria sem dados faciais. Perfil mínimo de referência inicial: Android intermediário equivalente a Snapdragon 778G/6 GB e iPhone com A14; P0 deve registrar os modelos físicos usados.

| Indicador | Gate V2 |
|---|---:|
| Captura até resultado local, p50 | ≤ 80 ms |
| Captura até resultado local, p95 | ≤ 150 ms |
| Mudança real até estado estável na UI, p95 | ≤ 600 ms, excluindo frames recusados |
| Inicialização do pipeline, p95 | ≤ 2 s |
| Endpoint de lote V2, p95 no servidor | ≤ 250 ms |
| Fila de frames | máximo 1 |
| Memória incremental do pipeline | ≤ 150 MB |
| Energia incremental sobre preview sem CV | aumento relativo ≤ 20% no consumo medido durante teste contínuo de 20 min |
| Condição térmica severa | nenhuma sessão sustentada em 20 min; reduzir cadência antes disso |
| Crash-free monitoring sessions | ≥ 99,5% |
| Egress de imagem no modo normal | 0 bytes |
| Eventos em estado estável | no máximo 1 heartbeat a cada 15 s |
| Disponibilidade offline da reação do pet | 100% após modelo carregado |

Todos os percentis devem informar aparelho, sistema, build, temperatura inicial, resolução e número de amostras. Média isolada não aprova release.

## 14. Observabilidade

### 14.1 Métricas no aparelho

- tempo por estágio e end-to-end;
- frames recebidos, processados e descartados;
- taxa de `unknown` por causa;
- cobertura de qualidade;
- frequência efetiva de cada estágio;
- mudanças confirmadas e mudanças suprimidas pela histerese;
- memória, temperatura/thermal state e modo adaptativo;
- tamanho/idade da fila de eventos e falhas de sincronização;
- versão de cada artefato.

### 14.2 Métricas no servidor

- lotes aceitos, duplicados e rejeitados;
- latência e erro por versão do app/schema;
- volume de eventos por sessão, sem cardinalidade pessoal em labels de métrica;
- distribuição de versões de modelo;
- taxa de feedback e concordância agregada;
- alertas oferecidos, confirmados, ignorados e revogados;
- acesso a dados de cuidador auditado.

### 14.3 Logs

- logs estruturados com correlation/event ID;
- amostragem em produção para sucesso;
- nunca registrar frame, Base64, distribuição completa associada a identidade em log comum ou nota de feedback;
- erros devem indicar estágio, versão e código sanitizado.

## 15. Testes e avaliação

### 15.1 Unitários

- transformação blendshape/AU;
- normalização e calibração;
- quality gate e cada motivo de recusa;
- fusão, discordância e abstinção;
- temporal com timestamps irregulares, gaps e transições;
- regressão do `UnboundLocalError` atual;
- idempotência, consolidação e retenção de eventos;
- regras de alerta e cooldown.

### 15.2 Contrato

- OpenAPI V2 validado no backend;
- tipos TypeScript gerados e verificados no app;
- testes de compatibilidade entre duas versões adjacentes;
- valores desconhecidos de enum não podem quebrar a UI: degradar para `unknown`.

### 15.3 Replay/golden set

- ferramenta determinística que executa o mesmo clip no baseline e no candidato;
- relatório automático com matriz de confusão, precision/recall/F1, cobertura, ECE, Brier e latência;
- teste de repetibilidade do mesmo artefato;
- golden clips para rotação/espelhamento/coordenadas;
- relatório versionado como artefato de CI, sem incluir mídia sensível.

### 15.4 Dispositivos

- Android baixo/intermediário/alto e pelo menos duas versões suportadas;
- iPhone mais antigo suportado e atual;
- câmera frontal em luz boa, baixa luz, contraluz, movimento e pose;
- 20 minutos contínuos para memória, bateria e thermal throttling;
- interrupções: chamada, bloqueio, background/foreground, permissão revogada e falta de rede.

### 15.5 Produto e segurança

- sem permissão, app continua funcional manualmente;
- nenhuma imagem no tráfego normal, validada por inspeção de rede;
- texto da UI revisado para incerteza e não diagnóstico;
- alerta não dispara por frame único nem por `unknown`;
- cuidador perde acesso imediatamente após revogação;
- exportação/exclusão cobre evento, feedback e vínculo.

## 16. Plano de implementação

### P0 — Estabilizar e medir o legado

**Objetivo:** criar um ponto de comparação confiável.

- corrigir o erro do temporal e adicionar regressão;
- introduzir `unknown` e impedir persistência de no-face como neutral;
- alinhar enums backend/app, incluindo `fearful`;
- renomear “precisão” para “confiança do sinal” e corrigir textos de privacidade;
- conectar o app atual a um adapter de fonte de emoção, mantendo a simulação somente em modo demo;
- inventariar commits/modelos/configuração e gerar o primeiro relatório de baseline;
- definir aparelhos físicos e owner de cada SLO;
- implementar autenticação/isolamento ou manter caregiver/history fora de produção.

**Saída:** baseline reproduzível e contrato semântico corrigido.

### P1 — Dataset e bancada de avaliação

**Objetivo:** tornar melhorias demonstráveis.

- criar manifest de dados, divisão por pessoa e holdout congelado;
- implementar replay e relatórios;
- adicionar quality set e fatias obrigatórias;
- medir V1, inclusive latência e erro confiante;
- registrar thresholds iniciais como configuração versionada.

**Saída:** scorecard assinado da V1 e gates definitivos.

### P2 — Spike móvel

**Objetivo:** comprovar viabilidade antes da migração completa.

- migrar Expo 54 -> 57 em mudança isolada;
- criar Development Build e módulo/config plugin nativo;
- integrar câmera + Face Landmarker live stream;
- testar ONNX Runtime Mobile/alternativa e quantização;
- medir cópia de frame, latência, memória, bateria e temperatura;
- validar lifecycle e ausência de frame na rede.

**Saída:** decisão técnica registrada sobre runtime, resolução e cadência.

### P3 — Pipeline V2 e API de eventos

**Objetivo:** entregar caminho local completo, ainda sem substituir todos os usuários.

- quality gate, features, classificador, fusão e temporal locais;
- fila local, batch V2, idempotência e intervalos no backend;
- resultado V2 integrado à UI, dashboard e feedback;
- remover rPPG/BPM e microexpressões do fluxo de produção;
- manter fallback V1 por feature flag.

**Saída:** versão interna funcional e offline.

### P4 — Qualidade do modelo

**Objetivo:** superar o baseline com evidência.

- comparar modelos candidatos e calibrar distribuições;
- ajustar qualidade, fusão e temporal no conjunto de desenvolvimento;
- avaliar holdout uma única vez por candidato de release;
- executar análise por fatia e resolver regressões;
- assinar artefato e scorecard aprovados.

**Saída:** candidato que satisfaz todos os gates de promoção.

### P5 — Shadow, canário e rollout

**Objetivo:** migrar com rollback seguro.

1. equipe interna, V2 sem alertas externos;
2. shadow consentido comparando decisões agregadas V1/V2;
3. canário de 5%;
4. 25%, 50% e 100%, com pelo menos 48 h de observação por etapa;
5. desativar fallback de frame após duas versões estáveis.

Pausar automaticamente a expansão se houver regressão de crash, latência, erro, `unknown`, consumo, alertas ou feedback negativo acima do limite definido no scorecard.

### P6 — Pesquisa opcional

- microexpressões somente com câmera de alta frequência, protocolo, dataset e objetivo de produto específicos;
- rPPG somente com vídeo em cadência adequada, controle de movimento/iluminação e ground truth de contato;
- nenhum resultado dessa trilha altera emoção, alerta ou mensagem clínica antes de validação própria e revisão de privacidade.

## 17. Feature flags e rollback

Flags recomendadas:

- `vision_v2_enabled`;
- `vision_v2_pixel_classifier_enabled`;
- `vision_v2_event_upload_enabled`;
- `vision_v2_feedback_enabled`;
- `vision_v2_support_rules_enabled`;
- `legacy_server_fallback_enabled`;
- `consented_shadow_comparison_enabled`.

Rollback deve permitir:

- desabilitar apenas classificador de pixels e manter geometria;
- desabilitar sincronização sem interromper inferência;
- voltar à experiência manual/demo sem voltar a transmitir frames;
- revogar uma versão de modelo remotamente por manifest assinado;
- preservar eventos já aceitos sem duplicação.

O fallback servidor não é o rollback permanente de privacidade; a saída segura final é experiência manual/local.

## 18. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Modelo melhora média e piora um grupo | Gates por fatia, abstinção e rollout gradual. |
| Native module aumenta complexidade Expo | Spike isolado, Development Build, config plugin e CI nativa antes da migração. |
| Consumo de bateria inviável | Cadência adaptativa, fila de um frame, classificador mais lento e benchmark contra preview. |
| `unknown` aparece demais | Orientação de luz/pose, quality reasons acionáveis e ajuste baseado em cobertura. |
| Usuário interpreta como diagnóstico | Separação de domínio, microcopy probabilística e confirmação explícita. |
| Feedback contém viés/ruído | Não treinar online; agregar, revisar e validar em holdout. |
| Dashboard quebra continuidade V1/V2 | Guardar origem/versão e migrar no-face legado para unknown. |
| Comprometimento de privacidade | Edge-first, zero imagem normal, autenticação, retenção mínima e auditoria. |
| Modelo móvel varia entre aparelhos | scorecard por tier, runtime fallback e manifest de compatibilidade. |

## 19. Definition of Done

A V2 só está concluída quando:

- o pet reage a resultado local real, offline, sem timer de simulação em produção;
- câmera e worker respeitam lifecycle e sessão visível;
- tráfego normal contém zero bytes de imagem;
- `unknown` representa no-face/baixa qualidade sem contaminar neutralidade;
- `anxious` não é classe visual e BPM/rPPG não altera o resultado;
- contrato V2, idempotência, feedback e intervalos estão em produção;
- autenticação e isolamento protegem histórico/cuidador;
- candidato cumpre scorecard de qualidade, calibração, fatias e SLOs;
- testes de replay, contrato, dispositivo, privacidade e alertas passam;
- observabilidade e feature flags permitem diagnosticar e reverter;
- textos de privacidade, confiança e apoio refletem o comportamento real;
- rollout de 100% completa duas versões estáveis antes da remoção da V1.

## 20. Fontes técnicas que fundamentam as decisões

- [Expo Camera no SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/) — lifecycle do preview, captura e configuração de permissões.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) — documentação versionada exigida pelo próprio projeto para a próxima integração.
- [MediaPipe Face Landmarker Options](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/FaceLandmarkerOptions) — modos IMAGE, VIDEO e LIVE_STREAM, blendshapes e parâmetros de confiança.
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/FaceLandmarker) — `detect_async`, timestamps e descarte de frames para reduzir latência em live stream.
- [ONNX Runtime Mobile](https://onnxruntime.ai/docs/tutorials/mobile/) — execução em Android/iOS, execution providers e necessidade de medir tamanho, latência e energia no dispositivo.
- [FER+ original](https://arxiv.org/abs/1608.01041) — origem e estratégia de rótulos do baseline atual.
- [AffectNet](https://arxiv.org/abs/1708.03985) — referência de dataset de expressões em condições reais; uso depende de licença e adequação ao domínio.
- [Emotional Expressions Reconsidered](https://pubmed.ncbi.nlm.nih.gov/31313636/) — limitações de inferir estado emocional interno diretamente de movimentos faciais.
- [CASME II](https://pmc.ncbi.nlm.nih.gov/articles/PMC3903513/) — benchmark de microexpressões capturado a 200 fps em ambiente controlado.
- [Remote heart rate measurement using color](https://pubmed.ncbi.nlm.nih.gov/23744659/) — base técnica de rPPG por crominância.
- [Android foreground service restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) — restrições de acesso à câmera a partir de background.

## 21. Decisão final proposta

**Aprovar a arquitetura edge-first e executar P0 e P1 antes de escolher um novo modelo.**

Essa sequência corrige inconsistências funcionais e semânticas, cria a régua que hoje falta e evita investir em uma troca de modelo impossível de provar. Em paralelo, P2 pode validar o pipeline nativo no SDK 57. A construção integral da V2 começa somente quando baseline, contrato e budgets estiverem registrados.
