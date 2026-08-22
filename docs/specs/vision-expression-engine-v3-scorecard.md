# Scorecard de desenvolvimento — Motor de Expressões Faciais V3

**Data:** 22 de agosto de 2026
**Base:** `main@3a6f50e`
**Classificador:** `expression-v3.0.0-selective`
**Pipeline Android:** `mellow-vision-v3.0.0-camera2-rgb`

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
- margem mínima e confiança mínima impedem classificação forçada;
- conflitos persistentes produzem `unknown/uncertain`;
- warm-up exige três hipóteses coerentes da mesma classe;
- transições continuam exigindo três atualizações e resistem a um frame isolado;
- calibração pessoal aplica deadband e normalização pelo espaço restante do
  coeficiente;
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
| Testes do app | 15/15 |
| Padrões canônicos das sete classes | passou |
| Padrões adversariais contaminados | passou |
| Ruído baixo e sorriso unilateral | permaneceu neutro |
| Conflito forte fearful/surprised | abstém em vez de chutar |
| Frame divergente isolado | não troca estado |
| TypeScript | passou |
| ESLint completo | passou |
| Expo Doctor | 18/18 |
| Backend em ambiente limpo | 63/63 |
| Compilação do módulo Kotlin/Camera2 | passou |
| APK debug ARM64 | gerado, 79.160.029 bytes |
| Permissão `RECORD_AUDIO` no APK | ausente |
| Alinhamento Android de 16 KiB | passou |
| Custo do classificador JS, 100.000 atualizações | 0,013 ms/update em média local |

**SHA-256 do APK:**
`15B9E5328D9E22BE8B2E957F84C6BC9FFC9A6A3979F6B3F7BE1280E8E3B512FB`

O benchmark JavaScript mede apenas scoring, suavização e decisão. Ele não mede
captura Camera2, conversão YUV, Face Landmarker, bridge React Native ou render.

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
os testes provam regressão de software, coerência das regras e compilação, mas
não permitem declarar aumento percentual de acurácia real. Como o projeto não
terá benchmark humano nesta etapa, a recomendação é liberar como beta
controlada após o teste funcional em aparelho, acompanhar cobertura,
abstenções, trocas e latência sem armazenar imagens e ajustar os gates com esse
feedback operacional.
