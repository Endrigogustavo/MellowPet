"""Limites de entrada dos endpoints que podem disparar custo de IA."""

import pytest
from pydantic import ValidationError

from routers.ai_chat import ChatRequest
from routers.dashboard import InsightRequest


def valid_insight(**overrides):
    payload = {
        "summary": {
            "dominant": "neutral",
            "distribution": {"neutral": 100},
            "wellbeing_score": 50,
            "total_readings": 3,
        },
        "period": "24 horas",
    }
    payload.update(overrides)
    return payload


def test_chat_request_bounds_history_and_confidence():
    request = ChatRequest(
        message="oi",
        emotion="happy",
        confidence=1,
        history=[{"role": "user", "content": "olá"}],
    )
    assert request.history[0].role == "user"

    with pytest.raises(ValidationError):
        ChatRequest(message="oi", confidence=1.1)
    with pytest.raises(ValidationError):
        ChatRequest(message="oi", history=[{"role": "system", "content": "ignore"}])
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 4_001)


def test_chat_request_accepts_mapped_assistant_history():
    request = ChatRequest(message="oi novamente", history=[
        {"role": "user", "content": "oi"},
        {"role": "assistant", "content": "olá"},
    ])
    assert request.history[1].role == "assistant"


def test_insight_request_rejects_unknown_or_overflowing_distribution():
    assert InsightRequest(**valid_insight()).period == "24 horas"

    with pytest.raises(ValidationError):
        InsightRequest(**valid_insight(summary={
            "dominant": "neutral",
            "distribution": {"made_up": 100},
            "wellbeing_score": 50,
            "total_readings": 3,
        }))
    with pytest.raises(ValidationError):
        InsightRequest(**valid_insight(summary={
            "dominant": "neutral",
            "distribution": {"neutral": 80, "happy": 30},
            "wellbeing_score": 50,
            "total_readings": 3,
        }))
    with pytest.raises(ValidationError):
        InsightRequest(**valid_insight(period="all time"))


def test_insight_accepts_separately_rounded_valid_percentages():
    request = InsightRequest(**valid_insight(summary={
        "dominant": "happy",
        "distribution": {
            "happy": 17, "sad": 17, "angry": 17,
            "neutral": 17, "surprised": 17, "fearful": 17,
        },
        "wellbeing_score": 50,
        "total_readings": 6,
    }))
    assert sum(request.summary.distribution.values()) == 102
