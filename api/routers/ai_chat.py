"""
AI Chat Router — Empathic conversational interface
"""
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import ai_chat_service
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


class ChatRequest(BaseModel):
    message: str
    emotion: str = "neutral"
    confidence: float = 0.5
    history: Optional[list] = None


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
        conversation_history=request.history,
    )
    return ChatResponse(response=response_text, emotion_context=request.emotion, provider=provider)
