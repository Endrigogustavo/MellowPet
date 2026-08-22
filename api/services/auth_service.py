"""
Senhas e tokens de sessao — hashing com bcrypt, sessao com JWT (HS256).
"""
from __future__ import annotations

import time

import bcrypt
import jwt

from config import settings


class TokenError(Exception):
    """Token ausente, expirado, malformado ou assinado com outro segredo."""


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_token(user_id: str, role: str) -> str:
    if not settings.jwt_secret:
        raise TokenError("JWT_SECRET nao configurada")
    now = int(time.time())
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + settings.jwt_expires_minutes * 60,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    if not settings.jwt_secret:
        raise TokenError("JWT_SECRET nao configurada")
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
