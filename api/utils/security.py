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
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


def client_ip(request: Request) -> str:
    """IP do cliente, considerando proxy apenas se explicitamente confiavel."""
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # O proxy confiável ACRESCENTA o IP que viu no fim da lista; o que
            # vem antes o próprio cliente escreve. Usar o primeiro deixava
            # qualquer um trocar de "IP" a cada requisição e fugir do limite.
            return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _is_public(path: str) -> bool:
    return path in settings.public_paths


class RequestSizeLimitMiddleware:
    """Corta corpos grandes antes do handler, inclusive requests chunked ou com
    Content-Length falsificado.

    Content-Length é só uma otimização rápida: clientes podem omiti-lo (chunked)
    ou declarar um valor menor que o corpo real. Por isso o middleware sempre
    lê os chunks até no máximo `settings.max_request_bytes` antes de entregar
    o request ao app, recusando com 413 assim que o total real ultrapassa o
    limite (sem depender de exception handlers internos).
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    @staticmethod
    async def _reject(send: Send, status_code: int, message: str) -> None:
        body = (message + "\n").encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": status_code,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        })
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        max_bytes = settings.max_request_bytes
        headers = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length")
        if raw_length is not None:
            try:
                declared = int(raw_length)
            except ValueError:
                await self._reject(send, 400, '{"error":"Invalid Content-Length header"}')
                return
            if declared < 0:
                await self._reject(send, 400, '{"error":"Invalid Content-Length header"}')
                return
            if declared > max_bytes:
                await self._reject(send, 413, '{"error":"Request body too large"}')
                return

        chunks: list[bytes] = []
        total = 0
        while True:
            message: Message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > max_bytes:
                await self._reject(send, 413, '{"error":"Request body too large"}')
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        body = b"".join(chunks)
        delivered = False

        async def replay_receive() -> Message:
            nonlocal delivered
            if delivered:
                # Depois do corpo, espera o desconecte DE VERDADE. Devolver
                # http.disconnect na hora fazia o BaseHTTPMiddleware achar que
                # o cliente tinha ido embora e cancelar a resposta: todo GET
                # (que não tem Content-Length) virava 500 "No response returned".
                return await receive()
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay_receive, send)


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
        # Teto de memória: inundar com IPs distintos não pode esgotar a RAM.
        if len(self._hits) > 100_000:
            self._last_sweep = 0
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
        # Compara bytes: com str, um caractere não-ASCII levantava TypeError
        # e a resposta virava 500 com traceback no log, em vez de 401.
        if not secrets.compare_digest(provided.encode("utf-8"), settings.api_key.encode("utf-8")):
            logger.warning("Chave invalida de %s em %s", client_ip(request), request.url.path
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Invalid or missing API key"},
            )
        return await call_next(request)


def security_headers() -> dict[str, str]:
    """Headers defensivos padrão. Usado pelo middleware e pelo handler de 500,
    que roda no ServerErrorMiddleware, por fora de todos os add_middleware."""
    headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
    }
    if settings.is_production:
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return headers


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Headers defensivos padrao nas respostas."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for name, value in security_headers().items():
            response.headers.setdefault(name, value)
        return response
