"""Rotas de IA com JWT do Supabase: sessão obrigatória e cota por usuário."""
import time

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import config
from routers import ai_chat
from services.ai_service import ai_chat_service

SECRET = "segredo-de-teste-do-supabase-com-tamanho-suficiente"


def token(sub="user-1", exp_in=3600, secret=SECRET, aud="authenticated"):
    return jwt.encode({"sub": sub, "aud": aud, "exp": int(time.time()) + exp_in}, secret, algorithm="HS256")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(config.settings, "supabase_jwt_secret", SECRET)
    monkeypatch.setattr(config.settings, "supabase_url", None)
    monkeypatch.setattr(config.settings, "ai_requests_per_minute_per_user", 3)
    monkeypatch.setattr(ai_chat_service, "available", False)
    app = FastAPI()
    app.include_router(ai_chat.router, prefix="/api/v1/chat")
    return TestClient(app)


def post(c, tok=None, msg="oi"):
    headers = {"Authorization": f"Bearer {tok}"} if tok else {}
    return c.post("/api/v1/chat/", json={"message": msg}, headers=headers)


def test_sem_sessao_ou_com_token_invalido_da_401(client):
    assert post(client).status_code == 401
    assert post(client, "lixo").status_code == 401
    assert post(client, token(secret="outro-segredo-qualquer-com-tamanho-ok")).status_code == 401
    assert post(client, token(exp_in=-10)).status_code == 401
    assert post(client, token(aud="anon")).status_code == 401


def test_sessao_valida_passa_e_cota_e_por_usuario(client):
    a = token("ana")
    assert [post(client, a).status_code for _ in range(4)] == [200, 200, 200, 429]
    # Outro usuário não é afetado pela cota da Ana.
    assert post(client, token("bia")).status_code == 200


def test_sem_configuracao_continua_aberto_como_antes(monkeypatch):
    monkeypatch.setattr(config.settings, "supabase_jwt_secret", None)
    monkeypatch.setattr(config.settings, "supabase_url", None)
    monkeypatch.setattr(ai_chat_service, "available", False)
    app = FastAPI()
    app.include_router(ai_chat.router, prefix="/api/v1/chat")
    assert TestClient(app).post("/api/v1/chat/", json={"message": "oi"}).status_code == 200


def test_mensagem_so_com_espacos_e_recusada(client):
    assert post(client, token(), msg="   ").status_code == 422
