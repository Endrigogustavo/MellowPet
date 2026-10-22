"""
Pet Router — o sonho da manhã.

Recebe só agregados do dia anterior (emoção dominante, contagens, nomes de
pets amigos) e devolve uma historinha. Os nomes são a única parte livre e
vão para o prompt, então passam por uma lista fechada de caracteres: nada de
quebras de linha, chaves ou sinais que ajudem a injetar instrução.
"""
from typing import Annotated, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from services.ai_service import ai_chat_service

router = APIRouter()

KnownEmotion = Literal["happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful"]

EMOTION_PT = {
    "happy": "alegria",
    "sad": "tristeza",
    "angry": "raiva",
    "neutral": "calma",
    "surprised": "surpresa",
    "disgusted": "nojo",
    "fearful": "medo",
}

PetName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=24, pattern=r"^[0-9A-Za-zÀ-ÖØ-öø-ÿ' -]+$"),
]


class DreamRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pet_name: PetName
    dominant: Optional[KnownEmotion] = None
    fed: int = Field(default=0, ge=0, le=50)
    played: int = Field(default=0, ge=0, le=200)
    breaths: int = Field(default=0, ge=0, le=50)
    friends: list[PetName] = Field(default_factory=list, max_length=3)


@router.post("/dream", summary="Write the pet's morning dream from yesterday's aggregates")
async def dream(request: DreamRequest):
    text, provider = await ai_chat_service.generate_dream(
        {
            "pet_name": request.pet_name,
            "dominant": EMOTION_PT.get(request.dominant or "", "nenhuma leitura"),
            "fed": request.fed,
            "played": request.played,
            "breaths": request.breaths,
            "friends": ", ".join(request.friends) or "nenhum",
        }
    )
    return {"dream": text, "provider": provider}
