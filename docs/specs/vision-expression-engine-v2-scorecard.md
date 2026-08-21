# Scorecard de desenvolvimento — Motor de Expressões Faciais V2

Data da medição: 2026-08-21. Este scorecard aprova apenas desenvolvimento interno. `N/A` ou
`bloqueado` nunca conta como aprovação silenciosa.

## Artefato Android

- APK: `app/android/app/build/outputs/apk/debug/app-debug.apk`
- ABI: arm64-v8a
- tamanho: 89.883.434 bytes
- SHA-256: `CC55F6216ABF81E7ED1CE8573F52AFE9374719681BDA1E5B54B536CA6B1E94A7`
- package: `com.mellowpet.app`
- min/target SDK: 24/36
- ADB: 1.0.41, platform-tools 37.0.1
- aparelho conectado durante a medição: nenhum

## Gates automatizados

| Gate | Resultado | Estado |
|---|---:|---|
| Expo Doctor | 21/21 | passou |
| TypeScript | sem erro | passou |
| ESLint | sem erro | passou |
| Testes app | 12/12 | passou |
| Testes backend | 54/54 | passou |
| Build módulo Android | Kotlin/CameraX/MediaPipe | passou |
| APK Android arm64 | 366 tarefas | passou |
| Permissão de microfone | ausente | passou |
| Classe visual `anxious` | ausente dos contratos/classificador | passou |
| Um quadro divergente troca estado | não | passou |
| Transição canônica em até 600 ms a 10 fps | até 6 atualizações | passou no teste sintético |
| Evento aceita frame/Base64 extra | não, schema `extra=forbid` | passou |
| Idempotência evento/feedback | repetição não duplica | passou |
| Heartbeat estável | 15 s | passou por implementação/teste de intervalo |
| Fila de frames | `KEEP_ONLY_LATEST` + uma inferência em voo | passou por implementação |
| Compatibilidade Android 16 KB | ELF `0x4000` | passou |

## Orçamento de latência

| Indicador | Gate | Resultado | Estado |
|---|---:|---:|---|
| Lote V2, 10 eventos, p95 | ≤ 250 ms | 36,906 ms | passou localmente |
| Lote V2, 50 eventos, p95 | ≤ 250 ms | 114,409 ms | passou localmente |
| Captura → resultado, p50 | ≤ 80 ms | sem aparelho | bloqueado |
| Captura → resultado, p95 | ≤ 150 ms | sem aparelho | bloqueado |
| Inicialização, p95 | ≤ 2 s | instrumentado, não medido | bloqueado |
| Mudança real → UI estável, p95 | ≤ 600 ms | teste sintético ≤ 6 updates | medição física pendente |

O benchmark do lote executa 100 iterações em processo, incluindo ASGI, validação Pydantic e SQLite,
mas exclui rede e TLS. Ele pode ser reproduzido com:

```powershell
cd api
.\.venv\Scripts\python.exe -m scripts.benchmark_vision_v2 --iterations 100 --batch-size 50
```

## Qualidade do modelo

| Métrica | Gate | Resultado | Estado |
|---|---:|---:|---|
| Macro-F1 seletivo | ≥ 0,78 | sem ground truth humano | bloqueado |
| Cobertura seletiva | ≥ 70% | sem amostra física rotulada | bloqueado |
| ECE | ≤ 0,08 | sem rótulos | bloqueado |
| Erro confiante | ≤ 5% | sem rótulos | bloqueado |
| Regressão por classe/fatia | limites da spec | sem holdout | bloqueado |

Os testes sintéticos cobrem as sete classes, quality gate, abstinção, calibração, tensão separada,
histerese e tempo máximo em atualizações. Eles são regressão de software, não evidência de acurácia
humana.

## Privacidade e rollout

| Controle | Estado |
|---|---|
| Pixels/landmarks não atravessam a ponte JS | passou por contrato e revisão |
| Contrato V2 não aceita imagem | passou |
| Upload de eventos desligado por padrão | passou |
| Feedback remoto desligado por padrão | passou |
| Endpoint legado de frames desligado por padrão | passou |
| Fila local criptografada, limitada e com backoff | passou por implementação |
| Inspeção de rede em dispositivo | bloqueado sem aparelho |
| Autenticação/isolamento real de conta | bloqueado |
| Consentimento persistente e revogável | bloqueado |
| iOS compilado e testado | bloqueado sem macOS/iPhone |
| Canário 5→25→50→100% | bloqueado até gates anteriores |

## Flags para build interno

- `EXPO_PUBLIC_VISION_V2_ENABLED=true` — padrão seguro já é ligado.
- `EXPO_PUBLIC_VISION_V2_EVENT_UPLOAD_ENABLED=true` — habilitar somente em ambiente interno.
- `EXPO_PUBLIC_VISION_V2_FEEDBACK_ENABLED=true` — depende do upload.
- `EXPO_PUBLIC_API_BASE_URL=https://...` — nunca incluir segredo na variável pública.
- `EXPO_PUBLIC_LEGACY_SERVER_FALLBACK_ENABLED=false` — padrão desligado.
- servidor: `LEGACY_FRAME_ENDPOINT_ENABLED=false` — padrão desligado.

## Veredito

Pronto para Development Build Android e validação física interna. Não aprovado para produção,
diagnóstico, alertas externos nem comparação de acurácia até resolver os gates explicitamente
bloqueados.
