"""Testes dos middlewares de seguranca, com requisicoes reais.

Monta um app minimo em vez de importar o main.py: assim os testes rodam sem
TensorFlow/DeepFace instalados e continuam exercitando o codigo de verdade.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import config
from utils.security import (
    ApiKeyMiddleware,
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)

API_KEY = "chave-de-teste-super-secreta"
RATE_LIMIT = 5


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(config.settings, "api_key", API_KEY)
    monkeypatch.setattr(config.settings, "max_request_bytes", 1000)
    monkeypatch.setattr(config.settings, "trust_proxy_headers", False)

    app = FastAPI()
    # Mesma ordem do main.py.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(ApiKeyMiddleware)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=RATE_LIMIT)
    app.add_middleware(RequestSizeLimitMiddleware)

    @app.get("/health")
    async def health():
        return {"ok": True}

    @app.post("/api/v1/emotion/analyze")
    async def analyze(payload: dict):
        return {"ok": True}

    return TestClient(app)


def post(client, **kwargs):
    return client.post("/api/v1/emotion/analyze", json={"a": 1}, **kwargs)


class TestApiKey:
    def test_health_e_publico(self, client):
        assert client.get("/health").status_code == 200

    def test_sem_chave_401(self, client):
        assert post(client).status_code == 401

    def test_chave_errada_401(self, client):
        assert post(client, headers={"X-API-Key": "errada"}).status_code == 401

    def test_resposta_de_erro_nao_vaza_a_chave(self, client):
        r = post(client, headers={"X-API-Key": "errada"})
        assert API_KEY not in r.text

    def test_chave_certa_passa(self, client):
        assert post(client, headers={"X-API-Key": API_KEY}).status_code == 200


class TestLimiteDeCorpo:
    def test_corpo_grande_413(self, client):
        r = client.post("/api/v1/emotion/analyze",
            json={"frame": "x" * 5000},
            headers={"X-API-Key": API_KEY},
        )
        assert r.status_code == 413

    def test_content_length_invalido_400(self, client):
        r = client.post("/api/v1/emotion/analyze",
            content=b"{}",
            headers={"X-API-Key": API_KEY, "Content-Length": "nao-e-numero"},
        )
        assert r.status_code in (400, 422)


class TestRateLimit:
    def test_dispara_429_apos_o_limite(self, client):
        codes = [post(client, headers={"X-API-Key": API_KEY}).status_code for _ in range(RATE_LIMIT + 4)]
        assert 429 in codes
        assert codes[0] == 200

    def test_health_nao_consome_o_limite(self, client):
        for _ in range(RATE_LIMIT + 4):
            post(client, headers={"X-API-Key": API_KEY})
        assert client.get("/health").status_code == 200

    def test_resposta_429_traz_retry_after(self, client):
        last = None
        for _ in range(RATE_LIMIT + 4):
            last = post(client, headers={"X-API-Key": API_KEY})
        assert last.status_code == 429
        assert "Retry-After" in last.headers


class TestHeadersDeSeguranca:
    def test_headers_presentes(self, client):
        h = client.get("/health").headers
        assert h["x-content-type-options"] == "nosniff"
        assert h["x-frame-options"] == "DENY"
        assert h["referrer-policy"] == "no-referrer"
