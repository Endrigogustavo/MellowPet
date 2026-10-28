"""Copiloto do cuidador: só agregados entram, crise tem resposta fixa."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from routers import care
from routers.care import CareChatRequest, describe
from services.ai_service import ai_chat_service


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(care.router, prefix="/api/v1/care")
    return TestClient(app)


def test_crise_responde_fixo_sem_modelo(client, monkeypatch):
    async def boom(*a, **k):
        raise AssertionError("modelo não pode ser chamado")

    monkeypatch.setattr(ai_chat_service, "_complete_async", boom)
    r = client.post("/api/v1/care/chat", json={"message": "meu filho disse que quer morrer"})
    assert r.json()["provider"] == "crisis"
    assert "192" in r.json()["response"]


def test_sem_ia_devolve_fallback(client, monkeypatch):
    monkeypatch.setattr(ai_chat_service, "available", False)
    r = client.post("/api/v1/care/chat", json={"message": "como puxo assunto?"})
    assert r.json() == {"response": None, "provider": "fallback"}


def test_prompt_recebe_so_o_resumo_agregado(client, monkeypatch):
    seen = {}

    async def fake(system, messages, max_tokens):
        seen["system"] = system
        return "Tente começar por algo leve.", "gemini"

    monkeypatch.setattr(ai_chat_service, "available", True)
    monkeypatch.setattr(ai_chat_service, "_complete_async", fake)
    r = client.post(
        "/api/v1/care/chat",
        json={"message": "meu filho está quieto", "summary": {"events": 40, "score": 35, "top_emotion": "sad", "difficult_share": 0.5}},
    )
    assert r.json()["response"] == "Tente começar por algo leve."
    assert "índice de sinais 35/100" in seen["system"]


def test_entrada_limitada():
    with pytest.raises(ValidationError):
        CareChatRequest(message="   ")
    with pytest.raises(ValidationError):
        CareChatRequest(message="oi", summary={"events": 1, "difficult_share": 2})
    with pytest.raises(ValidationError):
        CareChatRequest(message="oi", summary={"events": 1, "texto_livre": "x"})
    assert describe(None).startswith("sem leituras")
