"""
Configuracao central da API MellowPet.

Tudo que muda entre ambientes passa por aqui. O ponto importante e o
`_validate_production`: em producao a aplicacao se recusa a subir com uma
configuracao insegura, em vez de subir aberta e ninguem perceber.
"""
from __future__ import annotations

import secrets
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Ambiente ────────────────────────────────────────────────────────────
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # ── Rede ────────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000

    # Origens permitidas no CORS, separadas por virgula.
    # Em producao, "*" e recusado — ver _validate_production.
    cors_origins: str = "*"

    # ── Autenticacao ────────────────────────────────────────────────────────
    # Chave compartilhada exigida no header X-API-Key.
    #
    # ATENCAO: o app mobile embute esta chave no bundle, entao ela e extraivel
    # por quem descompilar o APK. Ela serve para barrar abuso casual e uso por
    # terceiros da URL publica — nao e autenticacao de usuario. Dados por
    # usuario exigiriam login de verdade (JWT + tabela de usuarios).
    api_key: str | None = None

    # Caminhos que continuam abertos (health check de load balancer, etc.).
    public_paths: tuple[str, ...] = ("/health", "/", "/docs", "/openapi.json", "/redoc")

    # ── Limites de uso ──────────────────────────────────────────────────────
    rate_limit_per_minute: int = 120
    max_frame_bytes: int = 4_000_000  # ~4 MB de base64 -> ~3 MB de JPEG
    max_request_bytes: int = 6_000_000

    # Ligue apenas quando a API estiver atras de um proxy/load balancer que
    # sobrescreve X-Forwarded-For. Com isso desligado, o rate limit usa o IP
    # da conexao — caso contrario qualquer cliente forjaria o header e
    # escaparia do limite.
    trust_proxy_headers: bool = False

    # ── Banco ───────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./mellowpet.db"

    # ── Deteccao ────────────────────────────────────────────────────────────
    emotion_confidence_threshold: float = 0.45
    no_face_alert_timeout_minutes: int = 10

    # ── Documentacao ────────────────────────────────────────────────────────
    # O Swagger fica desligado em producao para nao expor a superficie da API.
    enable_docs: bool = True

    # ── Provedores de IA ────────────────────────────────────────────────────
    # Provedor preferido; os demais viram fallback automatico se este falhar.
    ai_provider: str = "gemini"
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # ── Alertas por e-mail ──────────────────────────────────────────────────
    enable_email_alerts: bool = False
    emergency_contact_email: str | None = None

    # Destinatarios permitidos, separados por virgula. Sem isso, a rota de
    # alerta aceitaria qualquer endereco e viraria um relay aberto: qualquer
    # pessoa poderia disparar e-mails com a marca MellowPet para quem quisesse.
    # Vazio = so o EMERGENCY_CONTACT_EMAIL pode receber.
    alert_email_allowlist: str = ""

    @property
    def allowed_alert_recipients(self) -> set[str]:
        allowed = {
            e.strip().lower()
            for e in self.alert_email_allowlist.split(",")
            if e.strip()
        }
        if self.emergency_contact_email:
            allowed.add(self.emergency_contact_email.strip().lower())
        return allowed

    @field_validator("log_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allow_wildcard_cors(self) -> bool:
        return self.cors_origin_list == ["*"]

    def validate_for_runtime(self) -> list[str]:
        """Checa a configuracao. Levanta em producao, avisa fora dela.

        Devolve a lista de avisos para que o startup possa registra-los.
        """
        problems: list[str] = []

        if self.allow_wildcard_cors:
            problems.append("CORS_ORIGINS='*' libera qualquer origem. Defina os dominios do ""app, ex.: CORS_ORIGINS=https://app.mellowpet.app")
        if not self.api_key:
            problems.append("API_KEY nao definida — a API aceita chamadas de qualquer cliente. "f"Sugestao de valor: {secrets.token_urlsafe(32)}")
        if self.debug:
            problems.append("DEBUG=true expõe detalhes de erro nas respostas.")
        if self.enable_docs and self.is_production:
            problems.append("ENABLE_DOCS=true publica o Swagger em producao. ""Defina ENABLE_DOCS=false.")

        if problems and self.is_production:
            raise RuntimeError("Configuracao insegura para APP_ENV=production:\n  - "+ "\n  - ".join(problems)
            )
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
