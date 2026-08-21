# ADR 0001 — Runtime visual no dispositivo

- Status: aceito para desenvolvimento interno
- Data: 2026-08-21
- Escopo: Motor de Expressões Faciais V2

## Contexto

O legado enviava JPEG/Base64 ao servidor e misturava ausência de evidência com `neutral`. Isso
aumentava latência, criava risco de privacidade e permitia que BPM/rPPG ou “microexpressões”
parecessem sinais validados sem cadência e ground truth adequados. O aplicativo também estava em
Expo SDK 54 e não possuía um caminho nativo local.

Não existe benchmark humano disponível nesta etapa. Portanto, nenhuma decisão deste ADR declara
melhora de acurácia real; promoção de modelo continua condicionada a dados rotulados independentes.

## Decisão

1. Usar Expo SDK 57 estável, React Native 0.86.2 e Development Build. Não promover SDK canário.
2. Implementar `mellow-vision` pela Expo Modules API, mantendo pixels e landmarks dentro do código
   nativo. A ponte recebe apenas blendshapes e telemetria agregada.
3. Usar MediaPipe Face Landmarker float16 v1:
   - Android: Tasks Vision 1.0.0;
   - iOS: `MediaPipeTasksVision` 0.10.21 fixo até um build macOS validar uma atualização.
4. Capturar a câmera frontal em 640×480, analisar até 10 fps e manter no máximo uma inferência em
   voo. Reduzir automaticamente para 7/4 fps conforme o estado térmico.
5. Classificar localmente sete expressões visuais (`happy`, `sad`, `angry`, `neutral`, `surprised`,
   `disgusted`, `fearful`) a partir de blendshapes/FACS aproximado. `anxious` permanece somente como
   autorrelato, nunca como classe visual.
6. Aplicar quality gate antes da classe, abstinção `unknown`, voto temporal de três amostras, EMA,
   margem mínima e histerese. Uma transição canônica estabiliza em até seis atualizações no teste
   automatizado, sem trocar por um único quadro divergente.
7. Aprender baseline pessoal somente após calibração explícita e guardar o baseline criptografado no
   armazenamento seguro do sistema.
8. Persistir/sincronizar somente intervalos e heartbeats agregados. A fila local é criptografada,
   limitada a 32 itens, retém no máximo sete dias e usa retry exponencial com jitter.
9. Desativar upload, feedback remoto e fallback de frames por padrão. O rollback seguro mantém a
   experiência local/manual em vez de reabrir egress de imagem.
10. Manter o classificador de pixels/ONNX atrás de flag e desligado. Sem benchmark independente não
    há evidência para justificar custo, bateria ou possível regressão por fatia.

## Consequências

- A reação local funciona offline após carregar o modelo.
- O caminho normal não contém imagem, crop, vídeo, landmarks ou Base64 no contrato de rede.
- `neutral` volta a ser uma classe observada; falta de rosto, qualidade ou margem produz `unknown`.
- O dashboard legado recebe temporariamente uma projeção dos intervalos V2 conhecidos, com origem
  `mobile_v2`; os intervalos completos continuam em tabela própria e idempotente.
- rPPG/BPM e microexpressões permanecem fora do fluxo ativo. Código legado só pode ser alcançado se
  o endpoint de frames for reaberto explicitamente.

## Alternativas não promovidas

- Inferência completa no servidor: rejeitada como caminho principal por latência e privacidade.
- Fotos periódicas: rejeitadas por custo de compressão e lacunas temporais.
- FER/ONNX no aparelho: spike conceitualmente suportado, mas não promovido sem ganho comprovado.
- Expo SDK 58 canário: rejeitado para esta entrega por não ser a linha estável validada.

## Evidência atual

- Android arm64 compilado com API/target 36, Java 17 e NDK 27.1.
- Bibliotecas MediaPipe do APK verificadas com alinhamento ELF de 16 KB.
- APK sem `RECORD_AUDIO`; câmera é a única permissão sensível do motor visual.
- Expo Doctor: 21/21 verificações.
- App: tipagem, lint e 12 testes do motor/fila/telemetria.
- Backend: 54 testes.
- Lote máximo de 50 eventos: p95 114,409 ms em ASGI + Pydantic + SQLite local, sem rede/TLS.

## Bloqueios para produção

- benchmark humano/holdout e análise por fatias;
- Android físico e iPhone para latência, memória, bateria, thermal e lifecycle;
- compilação iOS em macOS;
- autenticação de usuário, autorização por recurso e revogação de cuidador;
- consentimento persistente para sincronização, inspeção de rede e revisão de privacidade;
- canário observado por pelo menos 48 horas em cada etapa.
