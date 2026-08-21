# Avaliação do motor de expressões

Esta pasta contém o contrato da bancada P1. Os arquivos `*.example.jsonl` são
somente um smoke test sintético da ferramenta; **não são evidência de qualidade
do modelo** e não podem aprovar promoção.

## Manifesto

Cada linha precisa conter:

- `sample_id`: identificador estável e sem dado pessoal;
- `subject_id`: identificador pseudônimo usado para garantir split por pessoa;
- `label`: uma das sete expressões observáveis;
- `media_path`: caminho local/seguro consumido pelo replay;
- `slices`: iluminação, pose, device tier e demais fatias consentidas;
- referência de licença/consentimento no manifesto real.

O holdout real não deve ser versionado junto com mídia facial. O repositório
guarda somente manifesto sanitizado, hashes e scorecards sem dados pessoais.

## Predições

Cada linha usa o mesmo `sample_id` e registra `predicted_label`,
`signal_status`, distribuição calibrada, latência e versões do pipeline/modelo.
Predição ausente e status diferente de `ready` contam como abstinção.

## Execução

```powershell
cd api
.\.venv\Scripts\python.exe -m scripts.evaluate_expression `
  --manifest evaluation\manifest.example.jsonl `
  --predictions evaluation\predictions.example.jsonl `
  --output evaluation\reports\smoke-scorecard.json
```

O relatório mede matriz de confusão, macro-F1 total e seletivo, balanced
accuracy, cobertura, ECE, Brier, erro confiante, latência e resultados por
fatia. `promotion.passed` só pode ser considerado para um dataset real,
congelado e separado por pessoa.

Para gerar as predições reais do baseline, instale também `requirements.txt`
no Python 3.12 e execute:

```powershell
.\.venv\Scripts\python.exe -m scripts.replay_dataset `
  --manifest C:\caminho-seguro\holdout.jsonl `
  --output evaluation\reports\baseline-p0.jsonl
```

Imagens são lidas diretamente. Para vídeo, cada linha do manifesto também deve
ter `timestamp_ms`, garantindo que todas as versões processem o mesmo frame.
