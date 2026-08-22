"""
User Settings Router — preferências persistidas por usuário (pet, alertas, música).

A tabela `user_settings` já existia no schema sem nenhum router expondo-a;
este é o primeiro consumidor.
"""
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from utils.database import database, user_settings
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)

DEFAULTS = {
    "pet_type": "seal",
    "pet_name": "Mellow",
    "emergency_contacts": [],
    "music_enabled": True,
    "alerts_enabled": True,
    "no_face_alert_minutes": 10,
    "preferred_music_mood": "calm",
}


class SettingsUpsertRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)
    pet_type: Optional[str] = Field(default=None, max_length=32)
    pet_name: Optional[str] = Field(default=None, max_length=64)
    emergency_contacts: Optional[list[str]] = None
    music_enabled: Optional[bool] = None
    alerts_enabled: Optional[bool] = None
    no_face_alert_minutes: Optional[int] = Field(default=None, ge=1, le=180)
    preferred_music_mood: Optional[str] = Field(default=None, max_length=32)


@router.get("/", summary="Get user settings (defaults if never saved)")
async def get_settings(user_id: str = Query(..., min_length=1, max_length=36)):
    row = await database.fetch_one(
        user_settings.select().where(user_settings.c.user_id == user_id)
    )
    if not row:
        return {"user_id": user_id, **DEFAULTS}
    return dict(row)


@router.put("/", summary="Create or update user settings")
async def upsert_settings(payload: SettingsUpsertRequest):
    existing = await database.fetch_one(
        user_settings.select().where(user_settings.c.user_id == payload.user_id)
    )
    fields = payload.model_dump(exclude={"user_id"}, exclude_none=True)

    if existing:
        if fields:
            await database.execute(
                user_settings.update()
                .where(user_settings.c.user_id == payload.user_id)
                .values(**fields)
            )
    else:
        await database.execute(
            user_settings.insert().values(user_id=payload.user_id, **{**DEFAULTS, **fields})
        )

    row = await database.fetch_one(
        user_settings.select().where(user_settings.c.user_id == payload.user_id)
    )
    return dict(row)
