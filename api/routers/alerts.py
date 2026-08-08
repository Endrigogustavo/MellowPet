"""
Alerts Router — Emergency and emotional alerts management
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from config import settings
from services.alert_service import (
    send_email_alert,
    build_emotion_alert_email,
    build_no_face_alert_email,
)
from utils.database import database, alerts_log
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


class EmotionAlertRequest(BaseModel):
    session_id: str = Field(..., max_length=64)
    user_id: Optional[str] = Field(None, max_length=64)
    user_name: str = Field("Usuário", max_length=80)
    emotion: str = Field(..., max_length=32)
    duration_minutes: float = Field(..., ge=0, le=1440)
    contact_email: Optional[EmailStr] = None


class NoFaceAlertRequest(BaseModel):
    session_id: str = Field(..., max_length=64)
    user_id: Optional[str] = Field(None, max_length=64)
    user_name: str = Field("Usuário", max_length=80)
    minutes_without_face: float = Field(..., ge=0, le=1440)
    contact_email: Optional[EmailStr] = None


def ensure_recipient_allowed(email: Optional[str]) -> Optional[str]:
    """Aceita o destinatario apenas se estiver na allowlist configurada.

    Sem esta checagem a rota seria um relay: qualquer um poderia disparar
    e-mails com a marca MellowPet para endereços arbitrários.
    """
    if not email:
        return None
    if not settings.enable_email_alerts:
        logger.info("Alertas por e-mail desligados — nada será enviado.")
        return None
    if email.strip().lower() not in settings.allowed_alert_recipients:
        raise HTTPException(
            status_code=403,
            detail="Recipient not allowed. Register it in ALERT_EMAIL_ALLOWLIST.",
        )
    return email


@router.post("/emotion", summary="Trigger emotion-based alert")
async def trigger_emotion_alert(
    request: EmotionAlertRequest,
    background_tasks: BackgroundTasks,
):
    recipient = ensure_recipient_allowed(request.contact_email)
    subject, body = build_emotion_alert_email(
        request.emotion, request.duration_minutes, request.user_name
    )

    # Log to DB
    await database.execute(
        alerts_log.insert().values(
            session_id=request.session_id,
            user_id=request.user_id,
            alert_type="emotion",
            emotion=request.emotion,
            message=subject,
            sent_to=recipient,
        )
    )

    if recipient:
        background_tasks.add_task(send_email_alert, recipient, subject, body)

    return {"status": "alert_queued", "type": "emotion", "emotion": request.emotion}


@router.post("/no-face", summary="Trigger no-face detection alert")
async def trigger_no_face_alert(
    request: NoFaceAlertRequest,
    background_tasks: BackgroundTasks,
):
    recipient = ensure_recipient_allowed(request.contact_email)
    subject, body = build_no_face_alert_email(
        request.minutes_without_face, request.user_name
    )

    await database.execute(
        alerts_log.insert().values(
            session_id=request.session_id,
            user_id=request.user_id,
            alert_type="no_face",
            message=subject,
            sent_to=recipient,
        )
    )

    if recipient:
        background_tasks.add_task(send_email_alert, recipient, subject, body)

    return {"status": "alert_queued", "type": "no_face", "minutes": request.minutes_without_face}


@router.get("/", summary="List alert history for one session")
async def list_alerts(
    session_id: str = Query(..., max_length=64, description="Sessão a consultar"),
    limit: int = Query(50, ge=1, le=200),
):
    """Histórico de alertas de uma sessão.

    `session_id` é obrigatório de propósito: sem ele a rota devolvia os alertas
    de todos os usuários, incluindo os e-mails de contato de emergência.
    """
    query = (
        alerts_log.select()
        .where(alerts_log.c.session_id == session_id)
        .order_by(alerts_log.c.created_at.desc())
        .limit(limit)
    )
    rows = await database.fetch_all(query)
    return {"alerts": [dict(r) for r in rows]}
