"""
AI Chat Router — Empathic conversational interface
"""
from typing import Literal
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from services.ai_service import ai_chat_service
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


class ChatResponse(BaseModel):
    response: str
    emotion_context: str
    provider: str


@router.post("/", response_model=ChatResponse, summary="Chat with empathic AI")
async def chat(request: ChatRequest):
    """Send a message to the AI assistant.
    The response adapts based on the user's currently detected emotion.
    """
    response_text, provider = await ai_chat_service.generate_response(
        user_message=request.message,
        emotion=request.emotion,
        confidence=request.confidence,
        conversation_history=[message.model_dump() for message in request.history],
    )
    return ChatResponse(response=response_text, emotion_context=request.emotion, provider=provider)
