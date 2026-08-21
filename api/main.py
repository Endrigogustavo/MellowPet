"""
MellowPet API — Emotion Detection & Interaction System
FastAPI backend for continuous facial expression analysis
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import emotion, history, alerts, dashboard, ai_chat, tools, vision_v2
from utils.database import init_db, close_db
from utils.logger import setup_logger
from utils.security import (
    ApiKeyMiddleware,
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    client_ip,
)

logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MellowPet API iniciando (env=%s)...", settings.app_env)

    # Fora de producao isto so avisa; em producao levanta e impede o boot.
    for warning in settings.validate_for_runtime():
        logger.warning("%s", warning)

    await init_db()
    logger.info("Banco inicializado")
    logger.info("CORS=%s · API key=%s · rate limit=%s/min",
        settings.cors_origin_list,
        "ativa" if settings.api_key else "DESLIGADA",
        settings.rate_limit_per_minute,
    )
    yield
    await close_db()
    logger.info("MellowPet API encerrando...")


app = FastAPI(
    title="MellowPet API",
    description="""
##  MellowPet — Intelligent Emotional Interaction System

API responsável por:
- Processamento contínuo de frames para detecção de expressões faciais
- Análise emocional em tempo real com modelos de Deep Learning
- Geração de insights comportamentais com IA
- Gerenciamento de alertas e notificações
- Dashboard com histórico emocional
- Chat empático com o Mellow, baseado na emoção detectada

### Expressões faciais observadas
`happy` · `sad` · `angry` · `surprised` · `neutral` · `disgusted` · `fearful` · `unknown`

`unknown` significa ausência de evidência visual suficiente. A API descreve
expressões observadas e não diagnostica o estado emocional da pessoa.

### Autenticação
Envie a chave compartilhada no header `X-API-Key` em todas as rotas `/api/v1/*`.
    """,
    version="2.0.0",
    contact={"name": "MellowPet Team"},
    lifespan=lifespan,
    # Swagger sai do ar em producao para nao publicar a superficie da API.
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

# ── Middleware ──────────────────────────────────────────────────────────────
# A ordem importa: o Starlette executa na ordem inversa do registro, entao o
# ultimo add_middleware e o primeiro a ver a requisicao. Queremos barrar corpo
# grande e excesso de chamadas antes de gastar CPU com autenticacao ou rotas.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ApiKeyMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.rate_limit_per_minute)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # Com credenciais ligadas o navegador recusa allow_origins=["*"], e a
    # combinacao das duas coisas seria justamente o buraco de CORS. A app
    # mobile autentica por header, entao nao precisa de cookie.
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
    max_age=600,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = round((time.perf_counter() - start) * 1000, 2)
    logger.info("%s %s -> %s (%sms)",
        request.method,
        request.url.path,
        response.status_code,
        duration,
    )
    return response


# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(emotion.router, prefix="/api/v1/emotion", tags=["Emotion Detection"])
app.include_router(history.router, prefix="/api/v1/history", tags=["Emotional History"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(ai_chat.router, prefix="/api/v1/chat", tags=["AI Chat"])
app.include_router(tools.router, prefix="/api/v1/tools", tags=["Tools"])
app.include_router(vision_v2.router, prefix="/api/v2", tags=["On-device Vision V2"])


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": "MellowPet API",
        "version": "2.0.0",
        "env": settings.app_env,
        "timestamp": time.time(),
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": " MellowPet API is running",
        "docs": "/docs" if settings.enable_docs else "disabled",
        "health": "/health",
    }


# ── Tratamento de erros ──────────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Erro de validacao sem devolver o corpo enviado.

    O default do FastAPI ecoa o input invalido — que aqui pode conter um frame
    da camera do usuario.
    """
    fields = [".".join(str(p) for p in err.get("loc", [])) for err in exc.errors()]
    logger.info("Validação falhou em %s: %s", request.url.path, fields)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Validation failed", "fields": fields},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Devolve uma mensagem generica; o detalhe fica so no log do servidor.

    Mandar str(exc) para o cliente vazava caminho de arquivo, driver do banco e
    trecho de query.
    """
    logger.error("Exceção não tratada em %s %s (ip=%s): %s",
        request.method,
        request.url.path,
        client_ip(request),
        exc,
        exc_info=True,
    )
    body = {"error": "Internal server error"}
    if settings.debug and not settings.is_production:
        body["detail"] = str(exc)
    return JSONResponse(status_code=500, content=body)
