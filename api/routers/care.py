"""
Care Router — copiloto de conversa para cuidadores.

Recebe a pergunta do cuidador e SÓ o resumo agregado que o próprio app já
mostra (índice, sinal mais frequente, tendência). Nunca eventos individuais,
textos de check-in ou conversa da pessoa acompanhada.
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator

from services.ai_service import ai_chat_service
from services.crisis import detect_crisis
from utils.auth import ai_user

router = APIRouter()

KnownEmotion = Literal["happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful"]

CARE_SYSTEM = """Você é o copiloto de cuidado do MellowPet. Ajuda quem cuida de alguém (pai, mãe,
parceiro, amigo) a puxar conversas respeitosas e a cuidar de si.

Regras:
1. Português do Brasil, acolhedor e prático, no máximo 5 frases. Sem emojis.
2. Dê roteiros concretos de conversa (frases que a pessoa pode dizer) quando pedirem.
3. O resumo abaixo é agregado e é inferência de expressão facial, NÃO o que a pessoa sente.
   Nunca diga que a pessoa "está" triste/ansiosa; fale em "sinais" e sugira perguntar.
4. Nada de diagnóstico, nada de vigilância, nada de checar o celular da pessoa escondido.
5. Risco à vida, autolesão ou violência: oriente ligar 192 (SAMU) ou 188 (CVV) e não deixar
   a pessoa sozinha.
6. Lembre que o cuidador também precisa de pausa quando ele parecer sobrecarregado.

Resumo agregado do período ({period}): {summary}
"""

CARE_CRISIS_REPLY = (
    "Se houver risco imediato, ligue 192 (SAMU) e fique por perto da pessoa. "
    "O CVV atende 24h no 188, inclusive quem está cuidando. Depois, procure um "
    "profissional de saúde mental para orientar os próximos passos."
)


class CareSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period: Literal["24 horas", "7 dias", "30 dias"] = "7 dias"
    events: int = Field(ge=0, le=1_000_000)
    score: Optional[int] = Field(default=None, ge=0, le=100)
    top_emotion: Optional[KnownEmotion] = None
    difficult_share: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)
    relationship: Optional[Literal["mae", "pai", "parceiro", "filho", "amigo", "outro"]] = None


class CareTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)


class CareChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2_000)
    history: list[CareTurn] = Field(default_factory=list, max_length=8)
    summary: Optional[CareSummary] = None

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must not be blank")
        return value

    def crisis_text(self) -> str:
        """Combina a mensagem atual com as últimas 2 mensagens do usuário no
        histórico — crise mencionada no contexto recente também recebe a
        orientação fixa imediata."""
        recent_user = [m.content for m in self.history if m.role == "user"][-2:]
        return " ".join([self.message, *recent_user])


def describe(summary: Optional[CareSummary]) -> str:
    if summary is None or summary.events == 0:
        return "sem leituras suficientes no período."
    parts = [f"{summary.events} leituras"]
    if summary.score is not None:
        parts.append(f"índice de sinais {summary.score}/100 (abaixo de 40 pede atenção)")
    if summary.top_emotion:
        parts.append(f"sinal mais frequente: {summary.top_emotion}")
    parts.append(f"{round(summary.difficult_share * 100)}% de sinais difíceis")
    if summary.relationship:
        parts.append(f"relação com quem cuida: {summary.relationship}")
    return "; ".join(parts) + "."


@router.post("/chat", summary="Conversation copilot for caregivers (aggregated data only)")
async def care_chat(request: CareChatRequest, _user: Optional[str] = Depends(ai_user)):
    if detect_crisis(request.crisis_text()):
        return {"response": CARE_CRISIS_REPLY, "provider": "crisis"}
    if not ai_chat_service.available:
        return {"response": None, "provider": "fallback"}
    period = request.summary.period if request.summary else "7 dias"
    system = CARE_SYSTEM.format(period=period, summary=describe(request.summary))
    messages = [m.model_dump() for m in request.history[-8:]] + [{"role": "user", "content": request.message}]
    text, provider = await ai_chat_service._complete_async(system, messages, max_tokens=500)
    if not text:
        return {"response": None, "provider": "fallback"}
    return {"response": text.strip(), "provider": provider}
