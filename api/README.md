# 🐾 MellowPet API

API backend para chat e insights de IA. A detecção visual acontece localmente no
app mobile com MediaPipe; a API não recebe frames nem pixels.

## Stack

- **FastAPI** — framework web assíncrono
- **MediaPipe Face Landmarker** — inferência local no app mobile
- **FastAPI** — endpoints assíncronos para IA e conteúdo
- **Supabase** — banco, autenticação e RLS acessados pelo app
- **Gemini, Anthropic e OpenAI** — provedores opcionais com fallback offline

## Quickstart

```bash
# 1. Crie o ambiente virtual
python3 -m venv venv
source venv/bin/activate      # Linux/macOS
venv\Scripts\activate         # Windows

# 2. Instale as dependências
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite api/.env com suas chaves (mínimo recomendado: GEMINI_API_KEY)

# 4. Rode a API
venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --loop asyncio --http h11 --reload
# ou: ./run_api.sh (carrega api/.env automaticamente; `MELLOWPET_RELOAD=0` para desativar reload)
```

Se aparecer erro de ambiente externo gerenciado (PEP 668), confirme que o terminal está com a venv ativada antes de instalar pacotes.

### Troubleshooting (Kali / PEP 668)

Se aparecer `externally-managed-environment` ou `ModuleNotFoundError: No module named 'cv2'`, você está usando o Python do sistema em vez da venv.

Use exatamente este fluxo:

```bash
cd api
source venv/bin/activate
python -m pip install -r requirements.txt
venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Se você ver `exit code 139` (segfault) ao subir com Uvicorn, use `--loop asyncio --http h11` e evite `uvicorn[standard]`.

A API estará disponível em: `http://localhost:8000`
Documentação Swagger: `http://localhost:8000/docs`

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/v1/dashboard/insight` | Insight sobre resumo calculado no app |
| `POST` | `/api/v1/chat/` | Chat empático baseado na emoção |
| `GET`  | `/api/v1/tools/*` | Conteúdo estático de apoio |
| `GET`  | `/health` | Health check |

## Fluxo de uso

```
App → MediaPipe local captura landmarks/blendshapes
    → classificador temporal local decide expressão, qualidade e abstinência
    → Supabase recebe apenas eventos agregados, sob RLS
    → API recebe somente chat/insights que exigem chave de provedor
```

## Estrutura

```
api/
├── main.py              # Entry point FastAPI
├── requirements.txt
├── .env.example
├── routers/
│   ├── dashboard.py     # Insight sobre métricas do app
│   ├── ai_chat.py       # Chat conversacional
│   └── tools.py         # Conteúdo estático de apoio
├── services/
│   └── ai_service.py    # Provedores e fallback offline
└── utils/
    ├── security.py      # API key, rate limit e limites de corpo
    └── logger.py        # Logging estruturado
```

## Autenticação

Todas as rotas `/api/v1/*` exigem a chave compartilhada no header:

```bash
curl -H "X-API-Key: $API_KEY" \
     "http://localhost:8000/api/v1/tools/affirmations?emotion=neutral"
```

Rotas públicas (sem chave): `/health`, `/`, e — quando `ENABLE_DOCS=true` — `/docs`.

Gere a chave com:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

> **Escopo desta proteção.** O app mobile embute a chave no bundle, então ela é
> extraível de um APK. Ela impede que terceiros usem sua API e sua cota de IA —
> não é autenticação de usuário. O histórico e as políticas RLS ficam no
> Supabase; esta API só expõe chat, insights e ferramentas.

## Produção

### Checklist antes de subir

A API valida a própria configuração no boot e **se recusa a subir** com
`APP_ENV=production` se algo abaixo estiver errado:

- [ ] `APP_ENV=production`
- [ ] `API_KEY` definida (a mesma no app, via `EXPO_PUBLIC_API_KEY`)
- [ ] `CORS_ORIGINS` com domínios explícitos — nunca `*`
- [ ] `ENABLE_DOCS=false` (não publica o Swagger)
- [ ] `DEBUG=false`
- [ ] TLS terminando num proxy à frente; se ele reescrever `X-Forwarded-For`,
      ligue `TRUST_PROXY_HEADERS=true` — só nesse caso
- [ ] Distribuir rate limit no gateway/Redis quando houver múltiplas réplicas

### Controles ativos

| Controle | Onde | Padrão |
|----------|------|--------|
| API key (`X-API-Key`) | `utils/security.py` | exigida se `API_KEY` estiver definida |
| Rate limit por IP | `utils/security.py` | 120 req/min |
| Limite de corpo | `utils/security.py` | 6 MB |
| CORS por allowlist | `main.py` | sem credenciais |
| Erro sem stacktrace | `main.py` | detalhe só no log |

**Limitação do rate limit:** o contador vive na memória do processo. Com mais de
um worker ou réplica, cada um mantém a própria janela e o limite efetivo se
multiplica. Para múltiplas instâncias, mova o controle para o gateway (nginx,
Cloudflare) ou para um contador em Redis.

### Runtime

- Os SDKs de IA são síncronos, mas a API os executa fora do event loop e aplica
  `AI_TIMEOUT_SECONDS` (padrão: 25s).
- Sem uma chave de provedor, chat e insights usam respostas offline seguras.

### Docker

```bash
cp .env.example .env    # preencha APP_ENV, API_KEY, CORS_ORIGINS
docker compose up --build -d
docker compose ps       # a coluna STATUS deve mostrar (healthy)
```

O container roda como usuário sem privilégio (`uid 10001`), tem `HEALTHCHECK` e
publica a porta só em `127.0.0.1` — coloque um proxy com TLS à frente.
