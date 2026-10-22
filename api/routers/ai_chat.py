"""
AI Chat Router — Empathic conversational interface
"""
import json
from typing import Annotated, Literal, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from services.ai_service import ai_chat_service
from services.chat_actions import split_action
from services.crisis import CRISIS_REPLY, detect_crisis
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


KnownEmotion = Literal[
    "happy",
    "sad",
    "angry",
    "neutral",
    "surprised",
    "disgusted",
    "fearful",
    "unknown",
]

MemoryNote = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4_000)
    emotion: KnownEmotion = "neutral"
    confidence: float = Field(default=0.5, ge=0, le=1)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)
    # Só chega quando a pessoa ligou a memória no app; fica guardada lá, não aqui.
    memory: list[MemoryNote] = Field(default_factory=list, max_length=8)


class ChatResponse(BaseModel):
    response: str
    emotion_context: str
    provider: str
    action: Optional[str] = None


@router.post("/", response_model=ChatResponse, summary="Chat with empathic AI")
async def chat(request: ChatRequest):
    """Send a message to the AI assistant.
    The response adapts based on the user's currently detected emotion.
    """
    # Risco à vida nunca vai para o modelo: a resposta é sempre a fixa.
    if detect_crisis(request.message):
        return ChatResponse(response=CRISIS_REPLY, emotion_context=request.emotion, provider="crisis")

    response_text, provider, action = await ai_chat_service.generate_response(
        user_message=request.message,
        emotion=request.emotion,
        confidence=request.confidence,
        conversation_history=[message.model_dump() for message in request.history],
        memory=request.memory,
    )
    return ChatResponse(response=response_text, emotion_context=request.emotion, provider=provider, action=action)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/stream", summary="Chat with empathic AI, streamed as Server-Sent Events")
async def chat_stream(request: ChatRequest):
    """Mesmo contrato do POST /, mas a resposta chega em pedaços:
    `data: {"delta": "..."}` várias vezes e por fim
    `data: {"done": true, "provider": "...", "action": ...}`."""

    async def events():
        if detect_crisis(request.message):
            yield _sse({"delta": CRISIS_REPLY})
            yield _sse({"done": True, "provider": "crisis", "action": None})
            return

        provider = "fallback"
        parts: list[str] = []
        async for name, piece in ai_chat_service.stream_response(
            user_message=request.message,
            emotion=request.emotion,
            confidence=request.confidence,
            conversation_history=[m.model_dump() for m in request.history],
            memory=request.memory,
        ):
            provider = name
            parts.append(piece)
            yield _sse({"delta": piece})

        if not parts:
            fallback = ai_chat_service._fallback_response(request.emotion)
            yield _sse({"delta": fallback})
        _, action = split_action("".join(parts))
        yield _sse({"done": True, "provider": provider, "action": action})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
