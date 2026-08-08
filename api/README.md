# 🐾 MellowPet API

API backend para detecção contínua de expressões faciais e interação emocional inteligente.

## Stack

- **FastAPI** — framework web assíncrono
- **DeepFace** — detecção de emoções com deep learning
- **OpenCV** — processamento de imagem
- **SQLite** (via `databases` + `aiosqlite`) — persistência leve
- **Anthropic Claude** — IA empática para chat e insights

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
# Edite api/.env com suas chaves (mínimo recomendado: OPENAI_API_KEY)

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
| `POST` | `/api/v1/emotion/analyze` | Analisa um frame base64 |
| `GET`  | `/api/v1/history/` | Histórico de eventos emocionais |
| `GET`  | `/api/v1/history/summary` | Resumo agregado por período |
| `GET`  | `/api/v1/dashboard/overview` | Dashboard completo com IA |
| `POST` | `/api/v1/chat/` | Chat empático baseado na emoção |
| `POST` | `/api/v1/alerts/emotion` | Disparar alerta emocional |
| `POST` | `/api/v1/alerts/no-face` | Disparar alerta sem rosto |
| `GET`  | `/health` | Health check |

## Fluxo de uso

```
App → captura frame da câmera (background)
    → POST /api/v1/emotion/analyze (intervalo varia por plataforma; Android pode ser mais espaçado para evitar shutter sound)
    → recebe emotion + mensagem + sugestão musical
    → pet reage na tela
    → se emoção negativa por X tempo → POST /api/v1/alerts/emotion
    → se sem rosto por 10min → POST /api/v1/alerts/no-face
```

## Estrutura

```
api/
├── main.py              # Entry point FastAPI
├── requirements.txt
├── .env.example
├── routers/
│   ├── emotion.py       # Frame processing
│   ├── history.py       # Historical data
│   ├── alerts.py        # Alert management
│   ├── dashboard.py     # Analytics + AI insights
│   └── ai_chat.py       # Conversational AI
├── services/
│   ├── emotion_service.py  # DeepFace + OpenCV
│   ├── ai_service.py       # Anthropic integration
│   └── alert_service.py    # Email/SMS alerts
└── utils/
    ├── database.py      # SQLite + tables
    └── logger.py        # Structured logging
```

## Autenticação

Todas as rotas `/api/v1/*` exigem a chave compartilhada no header:

```bash
curl -H "X-API-Key: $API_KEY" \
     "http://localhost:8000/api/v1/history/?session_id=abc"
```

Rotas públicas (sem chave): `/health`, `/`, e — quando `ENABLE_DOCS=true` — `/docs`.

Gere a chave com:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

> **Escopo desta proteção.** O app mobile embute a chave no bundle, então ela é
> extraível de um APK. Ela impede que terceiros usem sua API e sua cota de IA —
> não é autenticação de usuário. Enquanto não houver login, qualquer pessoa com
> um `session_id` válido lê o histórico daquela sessão.

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
- [ ] `ALERT_EMAIL_ALLOWLIST` preenchida se `ENABLE_EMAIL_ALERTS=true`
- [ ] Volume do SQLite com backup (guarda histórico emocional)

### Controles ativos

| Controle | Onde | Padrão |
|----------|------|--------|
| API key (`X-API-Key`) | `utils/security.py` | exigida se `API_KEY` estiver definida |
| Rate limit por IP | `utils/security.py` | 120 req/min |
| Limite de corpo | `utils/security.py` | 6 MB |
| Limite de frame | `routers/emotion.py` | 4 MB |
| CORS por allowlist | `main.py` | sem credenciais |
| Erro sem stacktrace | `main.py` | detalhe só no log |
| Allowlist de e-mail | `routers/alerts.py` | destinatário precisa estar liberado |
| Escopo obrigatório | `routers/history.py` | exige `session_id` ou `user_id` |

**Limitação do rate limit:** o contador vive na memória do processo. Com mais de
um worker ou réplica, cada um mantém a própria janela e o limite efetivo se
multiplica. Para múltiplas instâncias, mova o controle para o gateway (nginx,
Cloudflare) ou para um contador em Redis.

### Runtime

- Para máxima compatibilidade com DeepFace/TensorFlow, use Python 3.11/3.12.
- Em Python 3.13, **DeepFace é desativado** e o fallback OpenCV também é **desativado por padrão** por estabilidade (evita segfault/exit 139). Nesse modo, `/emotion/analyze` responde, mas tende a retornar `neutral` com `face_detected=false`.
- Para forçar o modo estável mesmo em Python 3.11/3.12, defina `MELLOWPET_DISABLE_OPENCV=1`.

### Docker

```bash
cp .env.example .env    # preencha APP_ENV, API_KEY, CORS_ORIGINS
docker compose up --build -d
docker compose ps       # a coluna STATUS deve mostrar (healthy)
```

O container roda como usuário sem privilégio (`uid 10001`), tem `HEALTHCHECK` e
publica a porta só em `127.0.0.1` — coloque um proxy com TLS à frente.
