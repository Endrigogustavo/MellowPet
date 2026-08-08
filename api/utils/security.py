"""
Middlewares de seguranca da API MellowPet.

Tres controles, aplicados nesta ordem no main.py:

  1. RequestSizeLimitMiddleware — recusa corpos grandes antes de le-los
  2. RateLimitMiddleware       — limita requisicoes por IP
  3. ApiKeyMiddleware          — exige X-API-Key nas rotas nao publicas

Limitacao conhecida do rate limit: o contador vive na memoria do processo.
Com mais de um worker/replica, cada um mantem a propria janela e o limite
efetivo se multiplica. Para varias instancias, mova o controle para o gateway
(nginx, Cloudflare, API Gateway) ou para um contador em Redis.
"""
from __future__ import annotations

import secrets
import time
from collections import defaultdict, deque

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


def client_ip(request: Request) -> str:
    """IP do cliente, considerando proxy apenas se explicitamente confiavel."""
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_public(path: str) -> bool:
    return path in settings.public_paths


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Corta corpos acima do limite antes que cheguem ao handler."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > settings.max_request_bytes:
                    # 413 literal: o nome da constante mudou entre versoes do
                    # Starlette (REQUEST_ENTITY_TOO_LARGE -> CONTENT_TOO_LARGE).
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Request body too large"},
                    )
            except ValueError:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Invalid Content-Length header"},
                )
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Janela deslizante de 60s por IP."""

    def __init__(self, app, requests_per_minute: int):
        super().__init__(app)
        self.limit = requests_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float) -> None:
        """Descarta IPs inativos para o dicionario nao crescer sem limite."""
        if now - self._last_sweep < 300:
            return
        for ip in [ip for ip, hits in self._hits.items() if not hits or now - hits[-1] > 120]:
            del self._hits[ip]
        self._last_sweep = now

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)

        now = time.monotonic()
        ip = client_ip(request)
        hits = self._hits[ip]

        while hits and now - hits[0] > 60:
            hits.popleft()

        if len(hits) >= self.limit:
            retry_after = max(1, int(60 - (now - hits[0])))
            logger.warning("Rate limit atingido para %s em %s", ip, request.url.path)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"error": "Too many requests"},
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)
        self._sweep(now)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - len(hits)))
        return response


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Exige X-API-Key fora das rotas publicas.

    Sem API_KEY configurada o middleware deixa passar — util em dev. Em
    producao o config.validate_for_runtime() impede o boot nesse estado.
    """
    async def dispatch(self, request: Request, call_next):
        if not settings.api_key:
            return await call_next(request)

        # Preflight de CORS nao carrega headers customizados.
        if request.method == "OPTIONS" or _is_public(request.url.path):
            return await call_next(request)

        provided = request.headers.get("x-api-key", "")
        # compare_digest evita vazar o tamanho/prefixo da chave por timing.
        if not secrets.compare_digest(provided, settings.api_key):
            logger.warning("Chave invalida de %s em %s", client_ip(request), request.url.path
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Invalid or missing API key"},
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Headers defensivos padrao nas respostas."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
