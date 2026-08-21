"""
Emotion Detection Router
Handles continuous frame processing from mobile and IoT sources
"""
import time
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import settings
from services.emotion import emotion_service, NEGATIVE_EMOTIONS
from services.alert_service import update_face_seen, check_no_face_alert, get_time_since_last_face
from utils.database import database, emotion_events
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


# ── Schemas ────────────────────────────────────────────────────────────────────

class FrameRequest(BaseModel):
    frame_b64: str = Field(..., description="Base64 encoded JPEG/PNG frame")
    session_id: str = Field(..., description="Unique session identifier")
    user_id: Optional[str] = Field(None, description="Optional user identifier")
    pet_name: str = Field("Mellow", max_length=40, description="User's pet name for messages")
    source: Literal["mobile", "iot"] = Field("mobile", description="Frame source device")


class EmotionResponse(BaseModel):
    emotion: str
    emotion_variant: str
    emotion_zone: str
    support_tip: str
    confidence: float
    secondary_emotion: Optional[str]
    all_scores: dict
    face_detected: bool
    processing_time_ms: float
    message: Optional[str]
    music_suggestions: list[str]
    timestamp: float
    no_face_alert: bool
    seconds_since_last_face: float
    should_trigger_alert: bool
    action_units: Optional[dict] = None
    micro_expressions: list = []
    detection_models_used: list[str] = []
    face_mesh_landmarks_count: int = 0
    compound_emotion: Optional[str] = None
    emotion_intensity: str = "mild"
    face_quality_metrics: Optional[dict] = None
    emotion_streak_seconds: float = 0.0
    heart_rate_bpm: Optional[float] = None
    heart_rate_confidence: float = 0.0
    heart_rate_status: str = "collecting"
    signal_status: str = "ready"
    quality_reasons: list[str] = Field(default_factory=list)
    tension_signal: Optional[float] = None
    pipeline_version: str = "legacy-server-p0"
    calibration_progress: Optional[float] = None


class CalibrationRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=EmotionResponse, summary="Analyze a single frame")
async def analyze_frame(request: FrameRequest):
    """Process a base64-encoded frame and return emotion analysis.
    
    Call this endpoint continuously (every 500ms–1s) from the app
    while the camera is active. The API handles deduplication and storage.
    """
    if not settings.legacy_frame_endpoint_enabled:
        raise HTTPException(
            status_code=410,
            detail="Legacy frame analysis is disabled; use the on-device V2 pipeline.",
        )
    if not request.frame_b64:
        raise HTTPException(status_code=400, detail="frame_b64 is required")

    # O frame vem de um cliente nao confiavel e vai direto para o decoder de
    # imagem. Barrar o tamanho aqui evita gastar CPU e memoria com um payload
    # feito so para derrubar o servico.
    if len(request.frame_b64) > settings.max_frame_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"frame_b64 exceeds {settings.max_frame_bytes} bytes",
        )

    logger.info("analyze request | session_id=%s source=%s user_id=%s frame_len=%s",
        request.session_id,
        request.source,
        request.user_id or "-",
        len(request.frame_b64),
    )

    result = await emotion_service.analyze_frame_base64(
        request.frame_b64,
        session_id=request.session_id,
        pet_name=request.pet_name,
        # Com user_id, a deteccao reaproveita a calibracao aprendida em sessoes
        # anteriores em vez de recomecar do zero.
        user_id=request.user_id,
    )

    # Update face tracking
    update_face_seen(request.session_id, result.face_detected)
    no_face_alert = check_no_face_alert(request.session_id)
    seconds_since = get_time_since_last_face(request.session_id)

    # Ausencia de rosto/qualidade nao e um evento emocional. Persistir esses
    # casos como neutral contaminava dashboard, tendencia e alertas.
    if result.signal_status == "ready" and result.emotion != "unknown":
        try:
            await database.execute(
                emotion_events.insert().values(
                    session_id=request.session_id,
                    user_id=request.user_id,
                    emotion=result.emotion,
                    confidence=result.confidence,
                    secondary_emotion=result.secondary_emotion,
                    all_scores=result.all_scores,
                    face_detected=result.face_detected,
                    source=request.source,
                    timestamp=result.timestamp,
                )
            )
        except Exception as exc:
            logger.error("DB write error: %s", exc)

    should_trigger = result.emotion in NEGATIVE_EMOTIONS and result.confidence > 0.7

    logger.info("analyze result | session_id=%s emotion=%s confidence=%.3f face_detected=%s processing_ms=%.1f trigger_alert=%s no_face_alert=%s",
        request.session_id,
        result.emotion,
        result.confidence,
        result.face_detected,
        result.processing_time_ms,
        should_trigger,
        no_face_alert,
    )

    return EmotionResponse(
        emotion=result.emotion,
        emotion_variant=result.emotion_variant,
        emotion_zone=result.emotion_zone,
        support_tip=result.support_tip,
        confidence=result.confidence,
        secondary_emotion=result.secondary_emotion,
        all_scores=result.all_scores,
        face_detected=result.face_detected,
        processing_time_ms=result.processing_time_ms,
        message=result.message,
        music_suggestions=result.music_suggestions,
        timestamp=result.timestamp,
        no_face_alert=no_face_alert,
        seconds_since_last_face=seconds_since,
        should_trigger_alert=should_trigger,
        action_units=result.action_units,
        micro_expressions=result.micro_expressions,
        detection_models_used=result.detection_models_used,
        face_mesh_landmarks_count=result.face_mesh_landmarks_count,
        compound_emotion=result.compound_emotion,
        emotion_intensity=result.emotion_intensity,
        face_quality_metrics=result.face_quality_metrics,
        emotion_streak_seconds=result.emotion_streak_seconds,
        heart_rate_bpm=result.heart_rate_bpm,
        heart_rate_confidence=result.heart_rate_confidence,
        heart_rate_status=result.heart_rate_status,
        signal_status=result.signal_status,
        quality_reasons=result.quality_reasons,
        tension_signal=result.tension_signal,
        pipeline_version=result.pipeline_version,
        calibration_progress=result.calibration_progress,
    )


@router.post(
    "/session/{session_id}/calibration/start",
    summary="Start an explicit resting-face calibration",
)
async def start_calibration(session_id: str, request: CalibrationRequest):
    """Inicia calibracao voluntaria; frames seguintes alimentam o baseline."""
    return emotion_service.begin_calibration(session_id, request.user_id)


@router.post(
    "/session/{session_id}/calibration/cancel",
    summary="Cancel a resting-face calibration",
)
async def cancel_calibration(session_id: str):
    return emotion_service.cancel_calibration(session_id)


@router.get("/session/{session_id}/status", summary="Get session status")
async def get_session_status(session_id: str):
    """Return current session face-tracking status."""
    return {
        "session_id": session_id,
        "seconds_since_last_face": get_time_since_last_face(session_id),
        "no_face_alert_pending": check_no_face_alert(session_id),
        "calibration": emotion_service.calibration_status(session_id),
    }


class EmotionTrendResponse(BaseModel):
    session_id: str
    trend: str  # improving / declining / stable / fluctuating
    trend_score: float  # -1 (worsening) to +1 (improving)
    dominant_emotion: str
    dominant_streak_seconds: float
    intensity_level: str
    recent_transitions: list
    emotion_distribution: dict  # emotion->percentage over last N readings
    reading_count: int


@router.get("/session/{session_id}/trend",
    response_model=EmotionTrendResponse,
    summary="Get emotion trend for a session",
)
async def get_session_trend(session_id: str):
    """Compute rolling emotion trend from recent readings."""
    state = emotion_service.tracker.get(session_id)
    if state is None or not state.emotion_history:
        return EmotionTrendResponse(
            session_id=session_id,
            trend="stable",
            trend_score=0.0,
            # Sem evidencia observada nao existe emocao dominante. `neutral`
            # e uma classe visual valida, nao um valor padrao para falta de dado.
            dominant_emotion="unknown",
            dominant_streak_seconds=0.0,
            intensity_level="calm",
            recent_transitions=[],
            emotion_distribution={},
            reading_count=0,
        )

    history = state.emotion_history[-60:]  # last 60 readings (~1 min)
    reading_count = len(history)

    # Emotion distribution
    counts: dict[str, int] = {}
    for h in history:
        e = h["emotion"]
        counts[e] = counts.get(e, 0) + 1
    distribution = {e: round(c / reading_count * 100, 1) for e, c in counts.items()}
    dominant = max(counts, key=counts.get)

    # Trend: compare positive score in first half vs second half
    positive_set = {"happy", "surprised"}
    negative_set = {"sad", "angry", "disgusted", "fearful"}
    mid = reading_count // 2 if reading_count >= 4 else 0

    def wellbeing_score(readings: list) -> float:
        if not readings:
            return 0.0
        pos = sum(1 for r in readings if r["emotion"] in positive_set)
        neg = sum(1 for r in readings if r["emotion"] in negative_set)
        total = len(readings) or 1
        return (pos - neg) / total

    if mid > 0:
        first_half = wellbeing_score(history[:mid])
        second_half = wellbeing_score(history[mid:])
        trend_score = round(second_half - first_half, 3)
    else:
        trend_score = 0.0

    # Count unique emotions in window
    unique_emotions = len(set(h["emotion"] for h in history))

    if unique_emotions >= 5 and reading_count >= 8:
        trend = "fluctuating"
    elif trend_score > 0.15:
        trend = "improving"
    elif trend_score < -0.15:
        trend = "declining"
    else:
        trend = "stable"

    # Latest intensity from confidence
    latest_conf = history[-1].get("confidence", 0.0) if history else 0.0
    if latest_conf >= 0.78:
        intensity = "extreme"
    elif latest_conf >= 0.60:
        intensity = "intense"
    elif latest_conf >= 0.42:
        intensity = "moderate"
    elif latest_conf >= 0.22:
        intensity = "mild"
    else:
        intensity = "calm"

    streak_seconds = round(time.time() - state.current_streak_start, 1)

    return EmotionTrendResponse(
        session_id=session_id,
        trend=trend,
        trend_score=trend_score,
        dominant_emotion=dominant,
        dominant_streak_seconds=streak_seconds,
        intensity_level=intensity,
        recent_transitions=state.emotion_transitions[-10:],
        emotion_distribution=distribution,
        reading_count=reading_count,
    )
