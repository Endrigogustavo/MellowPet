"""
Auth Router — cadastro, login e sessao (JWT).
"""
import uuid

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from services.auth_service import TokenError, create_token, decode_token, hash_password, verify_password
from utils.database import database, users
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)

ROLES = ("user", "care")


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    role: str = "user"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    display_name: str | None
    role: str


async def _issue(user_id: str, email: str, display_name: str | None, role: str) -> AuthResponse:
    try:
        token = create_token(user_id, role)
    except TokenError as exc:
        logger.error("Nao foi possivel emitir token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login temporariamente indisponivel (JWT_SECRET ausente no servidor)",
        ) from exc
    return AuthResponse(token=token, user_id=user_id, email=email, display_name=display_name, role=role)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest):
    if payload.role not in ROLES:
        raise HTTPException(status_code=422, detail=f"role deve ser um de {ROLES}")

    email = payload.email.lower()
    existing = await database.fetch_one(users.select().where(users.c.email == email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado")

    user_id = str(uuid.uuid4())
    await database.execute(
        users.insert().values(
            id=user_id,
            email=email,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
            role=payload.role,
        )
    )
    logger.info("Novo usuario cadastrado (role=%s)", payload.role)
    return await _issue(user_id, email, payload.display_name, payload.role)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower()
    row = await database.fetch_one(users.select().where(users.c.email == email))
    # Mesma mensagem para e-mail inexistente e senha errada — nao confirmar
    # se um e-mail esta cadastrado.
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos")
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise invalid
    return await _issue(row["id"], row["email"], row["display_name"], row["role"])


@router.get("/me", response_model=AuthResponse)
async def me(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        claims = decode_token(authorization.removeprefix("Bearer ").strip())
    except TokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

    row = await database.fetch_one(users.select().where(users.c.id == claims.get("sub")))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return AuthResponse(
        token=authorization.removeprefix("Bearer ").strip(),
        user_id=row["id"],
        email=row["email"],
        display_name=row["display_name"],
        role=row["role"],
    )
