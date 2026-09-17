# Scorecard de desenvolvimento — Motor de Expressões Faciais V3

**Data:** 17 de setembro de 2026
**Base:** `origin/main@b7e2736`
**Classificador:** `expression-v3.5.0-absolute-evidence`
**Pipeline nativo:** `mellow-vision-v3.1.0-native`

## Objetivo

Reduzir confusões e trocas entre `happy`, `sad`, `angry`, `neutral`,
`surprised`, `disgusted` e `fearful`, mantendo baixa latência e retornando
`unknown` quando a face não fornece evidência coerente. O resultado descreve
uma expressão visual observada; não diagnostica o estado emocional interno da
pessoa.

## Mudanças principais

- ativação suave elimina coeficientes baixos que antes eram amplificados como
  evidência forte;
- sinais bilaterais consideram simetria sem rejeitar expressões naturalmente
  assimétricas;
- cada classe combina ações faciais complementares e desconta contradições;
- `neutral` usa baixa atividade global e o coeficiente neutro do MediaPipe;
- margem mínima, confiança heurística baseada em evidência pré-normalização e separação da segunda classe
  reduzem classificação forçada;
- conflitos persistentes produzem `unknown/uncertain`;
- calibração pessoal só aceita frames neutros, estáveis e com qualidade mínima,
  além de aplicar deadband e normalização pelo espaço restante do coeficiente;
- Camera2 converte YUV diretamente para RGB, removendo o caminho com perdas
  YUV → JPEG → Bitmap antes do Face Landmarker.

## Evidência visual por classe

| Classe | Sinais principais | Contradições relevantes |
|---|---|---|
| happy | sorriso bilateral, bochechas, covinhas, olhos semicerrados | sobrancelhas baixas, testa franzida, boca pressionada, nariz enrugado |
| sad | cantos da boca baixos, sobrancelha interna alta, lábio inferior, olhos fechando | sorriso, bochechas altas, olhos muito abertos, nariz enrugado |
| angry | sobrancelhas baixas, boca pressionada, nariz, olhos semicerrados | sorriso, bochechas altas, sobrancelhas externas altas |
| surprised | mandíbula aberta, olhos e sobrancelhas elevados | olhos fechados, sobrancelhas baixas, boca pressionada, nariz enrugado |
| fearful | olhos abertos, boca esticada, sobrancelhas internas/externas e tensão | sorriso, bochechas altas, nariz enrugado, olhos fechados |
| disgusted | nariz enrugado, lábio superior, boca projetada e testa | sorriso, bochechas altas, olhos muito abertos, mandíbula aberta |
| neutral | pouca atividade e coeficiente neutro do MediaPipe | evidência coerente forte de qualquer outra classe |

## Gates automatizados

| Gate | Resultado |
|---|---:|
| Testes do app | 48/48 (inclui seleção e paginação em SQLite local) |
| Padrões canônicos das sete classes | passou |
| Padrões adversariais contaminados | passou |
| Ruído baixo e sorriso unilateral | permaneceu neutro |
| Conflito forte fearful/surprised | mantém classe plausível sob o gate atual |
| Frame divergente isolado | não troca estado |
| TypeScript | passou |
| ESLint completo | passou sem avisos |
| Expo Doctor | 18/18, sem problemas |
| Backend em ambiente Python 3.12 novo | 22/22 testes passaram; avisos de dependências e cache do pytest |
| Build nativo Android/iOS | não executado: projeto nativo não está gerado no checkout |
| Custo do classificador JS, 100.000 atualizações | p50 0,0152 ms; p95 0,0308 ms; p99 0,1489 ms; 46.897 atualizações/s nesta máquina |

O benchmark JavaScript mede apenas scoring, suavização e decisão. Ele não mede
captura Camera2, conversão YUV, Face Landmarker, bridge React Native ou render.
Reprodução: `cd app; npm run benchmark:vision -- 100000`. Os números dependem
da máquina e não substituem a medição de latência no dispositivo.

A confiança exibida ainda não é uma probabilidade calibrada. A nova fórmula
considera a força dos sinais antes da normalização, mas sua qualidade precisa
ser medida contra um conjunto humano rotulado antes de qualquer alegação de
ganho de acurácia.

## Protocolo de validação física

1. Usar Development Build, luz frontal estável e câmera na altura dos olhos.
2. Executar a calibração mantendo expressão neutra por dez frames aceitos.
3. Manter cada expressão por cinco segundos e voltar ao neutro entre classes.
4. Repetir com luz boa e luz baixa, sem inclinar o rosto.
5. Registrar classe observada, confiança, qualidade, latência e qualquer troca
   incorreta. Não registrar nem enviar imagens.
6. Repetir em pelo menos um Xiaomi/MIUI e um aparelho de outro fabricante.

## Limite de evidência

Não há amostra humana rotulada ou aparelho conectado nesta medição. Portanto,
os testes provam regressão de software, coerência das regras e validação
estática, mas não permitem declarar aumento percentual de acurácia real. O
próximo gate de qualidade precisa ser um conjunto humano rotulado, dividido em
treino/validação/teste, com macro-F1, matriz de confusão, cobertura de
abstenção, calibração de confiança e cortes por dispositivo, iluminação e pose.
