"""Testes de hashing de senha e emissao/validacao de token (services/auth_service.py)."""
import time

import jwt
import pytest

import config
from services.auth_service import TokenError, create_token, decode_token, hash_password, verify_password

SECRET = "segredo-de-teste-32-bytes-ou-mais"


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setattr(config.settings, "jwt_secret", SECRET)
    monkeypatch.setattr(config.settings, "jwt_expires_minutes", 60)


class TestSenha:
    def test_hash_nao_e_a_senha_em_texto_puro(self):
        assert hash_password("minhasenha123") != "minhasenha123"

    def test_verify_aceita_senha_correta(self):
        h = hash_password("minhasenha123")
        assert verify_password("minhasenha123", h) is True

    def test_verify_rejeita_senha_errada(self):
        h = hash_password("minhasenha123")
        assert verify_password("outrasenha", h) is False

    def test_hashes_do_mesmo_password_sao_diferentes(self):
        # bcrypt gera salt aleatorio por chamada.
        assert hash_password("minhasenha123") != hash_password("minhasenha123")


class TestToken:
    def test_roundtrip_decodifica_o_mesmo_user_id_e_role(self):
        token = create_token("user-123", "care")
        claims = decode_token(token)
        assert claims["sub"] == "user-123"
        assert claims["role"] == "care"

    def test_token_assinado_com_outro_segredo_e_rejeitado(self):
        forged = jwt.encode({"sub": "x", "role": "user"}, "outro-segredo", algorithm="HS256")
        with pytest.raises(TokenError):
            decode_token(forged)

    def test_token_expirado_e_rejeitado(self):
        token = jwt.encode(
            {"sub": "user-123", "role": "user", "iat": int(time.time()) - 120, "exp": int(time.time()) - 60},
            SECRET,
            algorithm="HS256",
        )
        with pytest.raises(TokenError):
            decode_token(token)

    def test_sem_jwt_secret_create_levanta(self, monkeypatch):
        monkeypatch.setattr(config.settings, "jwt_secret", None)
        with pytest.raises(TokenError):
            create_token("user-123", "user")

    def test_sem_jwt_secret_decode_levanta(self, monkeypatch):
        token = create_token("user-123", "user")
        monkeypatch.setattr(config.settings, "jwt_secret", None)
        with pytest.raises(TokenError):
            decode_token(token)
