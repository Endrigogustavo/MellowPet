"""
Autenticação por usuário (JWT do Supabase) e cota por pessoa nas rotas de IA.

A X-API-Key vai embutida no APK e qualquer um a extrai — sozinha, ela deixa a
API virar um proxy de IA grátis. Com SUPABASE_JWT_SECRET (projetos com chave
HS256) ou SUPABASE_URL (projetos com JWKS assimétrico) configurados, as rotas
de IA exigem o token da sessão do app e limitam chamadas por usuário, não por
IP (atrás do proxy do Render, IP é de todo mundo ao mesmo tempo).

Sem nenhuma das duas variáveis, o comportamento é o anterior (só a chave),
para o deploy não quebrar antes de a configuração existir.
"""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from typing import Optional

import jwt
from fastapi import HTTPException, Request, status

from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

_jwks_client: Optional[jwt.PyJWKClient] = None


def auth_configured() -> bool:
    return bool(settings.supabase_jwt_secret or settings.supabase_url)


def _verify(token: str) -> dict:
    if settings.supabase_jwt_secret:
        return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
    global _jwks_client
    if _jwks_client is None:
        url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)
    key = _jwks_client.get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")


class _PerUserLimiter:
    """Janela deslizante de 60 s por usuário, com teto de memória."""

    MAX_USERS = 50_000

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, user: str, limit: int) -> bool:
        now = time.monotonic()
        if len(self._hits) > self.MAX_USERS:
            for key in [k for k, h in self._hits.items() if not h or now - h[-1] > 60]:
                del self._hits[key]
        hits = self._hits[user]
        while hits and now - hits[0] > 60:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


_limiter = _PerUserLimiter()


async def ai_user(request: Request) -> Optional[str]:
    """Dependência das rotas de IA: id do usuário (sub) ou None sem auth configurada."""
    if not auth_configured():
        return None
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão necessária")
    try:
        claims = await asyncio.to_thread(_verify, header[7:].strip())
    except Exception as exc:  # assinatura, expiração, audiência, JWKS fora
        logger.warning("Token recusado: %s", type(exc).__name__)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada") from None
    user = str(claims.get("sub") or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida")
    if not _limiter.allow(user, settings.ai_requests_per_minute_per_user):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas mensagens seguidas; espere um pouco")
    return user
