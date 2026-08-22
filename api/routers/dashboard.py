"""
Dashboard Router — AI-generated insight only.

Métricas (linha do tempo, distribuição, índice de bem-estar) são calculadas
no cliente a partir de leituras lidas direto do Supabase (RLS decide o que
cada usuário pode ver). Este endpoint existe só porque gerar o insight
precisa de uma chave de provedor de IA, que não pode ir para o app.
"""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from services.ai_service import ai_chat_service
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)

KnownEmotion = Literal["happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful"]


class InsightSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dominant: KnownEmotion
    distribution: dict[str, float] = Field(max_length=8)
    wellbeing_score: float = Field(ge=0, le=100)
    total_readings: int = Field(ge=0, le=1_000_000)


class InsightRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: InsightSummary
    period: str = Field(min_length=1, max_length=32)


@router.post("/insight", summary="Generate an AI insight for an already-computed emotion summary")
async def generate_insight(request: InsightRequest):
    insight, provider = await ai_chat_service.generate_insight(request.summary.model_dump(), request.period)
    return {"insight": insight, "provider": provider}
