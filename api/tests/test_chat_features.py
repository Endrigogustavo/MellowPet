"""Crise antes do LLM, ações sugeridas, memória e streaming do chat."""
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from routers import ai_chat
from routers.ai_chat import ChatRequest
from services.ai_service import ai_chat_service
from services.chat_actions import split_action
from services.crisis import CRISIS_REPLY, detect_crisis


@pytest.mark.parametrize(
    "text",
    [
        "eu quero morrer",
        "Às vezes PENSO EM MORRER",
        "não aguento mais viver",
        "nao aguento mais existir",
        "vou me matar",
        "pensei em suicídio",
        "seria melhor se eu não existisse",
        "ninguém ia sentir minha falta",
    ],
)
def test_crisis_detects_risk_with_or_without_accents(text):
    assert detect_crisis(text)


@pytest.mark.parametrize("text", ["morri de rir", "estou morrendo de fome", "quero dormir", "que dia cansativo"])
def test_crisis_ignores_everyday_phrases(text):
    assert not detect_crisis(text)


def test_split_action_keeps_only_known_actions():
    assert split_action("Vamos respirar juntos? [[acao:respirar]]") == ("Vamos respirar juntos?", "respirar")
    assert split_action("Oi [[ACAO: musica ]]") == ("Oi", "musica")
    assert split_action("Oi [[acao:apagar_tudo]]") == ("Oi", None)
    assert split_action("Sem ação.") == ("Sem ação.", None)


def test_memory_is_bounded():
    ChatRequest(message="oi", memory=["gosto de gatos"] * 8)
    with pytest.raises(ValidationError):
        ChatRequest(message="oi", memory=["x"] * 9)
    with pytest.raises(ValidationError):
        ChatRequest(message="oi", memory=["x" * 161])


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(ai_chat.router, prefix="/api/v1/chat")
    return TestClient(app)


def _events(body: str):
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


def test_crisis_never_reaches_the_model(client, monkeypatch):
    async def boom(*args, **kwargs):
        raise AssertionError("o modelo não pode ser chamado em crise")

    monkeypatch.setattr(ai_chat_service, "generate_response", boom)
    r = client.post("/api/v1/chat/", json={"message": "quero morrer"})
    assert r.status_code == 200
    assert r.json()["provider"] == "crisis"
    assert r.json()["response"] == CRISIS_REPLY

    s = client.post("/api/v1/chat/stream", json={"message": "quero morrer"})
    events = _events(s.text)
    assert events[0]["delta"] == CRISIS_REPLY
    assert events[-1] == {"done": True, "provider": "crisis", "action": None}


def test_stream_sends_pieces_then_action(client, monkeypatch):
    async def fake_stream(**kwargs):
        for piece in ["Vamos ", "respirar? ", "[[acao:respirar]]"]:
            yield "gemini", piece

    monkeypatch.setattr(ai_chat_service, "stream_response", fake_stream)
    r = client.post("/api/v1/chat/stream", json={"message": "tô ansioso"})
    assert r.headers["content-type"].startswith("text/event-stream")
    events = _events(r.text)
    assert [e["delta"] for e in events[:-1]] == ["Vamos ", "respirar? ", "[[acao:respirar]]"]
    assert events[-1] == {"done": True, "provider": "gemini", "action": "respirar"}


def test_stream_without_ai_falls_back(client, monkeypatch):
    async def empty(**kwargs):
        return
        yield  # noqa: unreachable — torna a função um gerador assíncrono

    monkeypatch.setattr(ai_chat_service, "stream_response", empty)
    events = _events(client.post("/api/v1/chat/stream", json={"message": "oi", "emotion": "sad"}).text)
    assert events[0]["delta"]
    assert events[-1]["provider"] == "fallback"
