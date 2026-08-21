"""Contrato de eventos agregados do pipeline visual executado no aparelho."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal, Optional

import sqlalchemy
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.exc import IntegrityError

from utils.database import database, emotion_events, vision_feedback, vision_intervals
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)

VisualExpression = Literal[
    "happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful", "unknown"
]
KnownVisualExpression = Literal[
    "happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful"
]
Score = Annotated[float, Field(ge=0.0, le=1.0)]
Identifier = Annotated[str, Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]
Version = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9@._+-]+$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class QualitySummary(StrictModel):
    mean: Score
    accepted_coverage: Score
    reasons: list[Annotated[str, Field(min_length=1, max_length=48)]] = Field(
        default_factory=list,
        max_length=16,
    )


class ExpressionEvent(StrictModel):
    event_id: Identifier
    kind: Literal["transition", "heartbeat", "session_end"]
    started_at: datetime
    ended_at: datetime
    duration_ms: int = Field(ge=0, le=86_400_000)
    observed_expression: VisualExpression
    expression_distribution: dict[KnownVisualExpression, Score] = Field(max_length=7)
    signal_confidence: Score
    quality: QualitySummary
    tension_signal: Optional[Score] = None
    model_version: Version
    pipeline_version: Version
    quality_config_version: Version
    calibration_version: Optional[Version] = None
    source: Literal["mobile"] = "mobile"

    @field_validator("started_at", "ended_at")
    @classmethod
    def timestamps_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include timezone")
        return value.astimezone(UTC)

    @model_validator(mode="after")
    def validate_interval_and_distribution(self):
        if self.ended_at < self.started_at:
            raise ValueError("ended_at must be greater than or equal to started_at")
        total = sum(self.expression_distribution.values())
        if self.observed_expression != "unknown":
            if self.observed_expression not in self.expression_distribution:
                raise ValueError("distribution must contain observed_expression")
            if not 0.95 <= total <= 1.05:
                raise ValueError("expression_distribution must sum approximately to one")
        elif total > 1.05:
            raise ValueError("expression_distribution must not exceed one")
        return self


class ExpressionEventBatch(StrictModel):
    session_id: Identifier
    device_session_id: Identifier
    # Campo transitorio enquanto a identidade real ainda nao existe. Em
    # producao ele deve ser substituido pelo subject do token autenticado.
    user_id: Optional[Identifier] = None
    events: list[ExpressionEvent] = Field(min_length=1, max_length=50)


class RejectedEvent(StrictModel):
    event_id: str
    reason: str


class ExpressionEventBatchResponse(StrictModel):
    accepted_event_ids: list[str]
    duplicate_event_ids: list[str]
    rejected: list[RejectedEvent]
    server_time: datetime


class ExpressionFeedbackRequest(StrictModel):
    feedback_id: Identifier
    event_id: Identifier
    agreement: Literal["yes", "no", "unsure"]
    self_reported_state: Optional[
        Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[\w -]+$")]
    ] = None
    corrected_observed_expression: Optional[KnownVisualExpression] = None
    note: Optional[Annotated[str, Field(min_length=1, max_length=500)]] = None
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def created_at_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include timezone")
        return value.astimezone(UTC)


def interval_values(request: ExpressionEventBatch, event: ExpressionEvent) -> dict:
    return {
        "event_id": event.event_id,
        "session_id": request.session_id,
        "device_session_id": request.device_session_id,
        "user_id": request.user_id,
        "kind": event.kind,
        "started_at": event.started_at.timestamp(),
        "ended_at": event.ended_at.timestamp(),
        "duration_ms": event.duration_ms,
        "observed_expression": event.observed_expression,
        "expression_distribution": event.expression_distribution,
        "signal_confidence": event.signal_confidence,
        "quality_mean": event.quality.mean,
        "accepted_coverage": event.quality.accepted_coverage,
        "quality_reasons": event.quality.reasons,
        "tension_signal": event.tension_signal,
        "model_version": event.model_version,
        "pipeline_version": event.pipeline_version,
        "quality_config_version": event.quality_config_version,
        "calibration_version": event.calibration_version,
        "source": event.source,
    }


def legacy_emotion_values(request: ExpressionEventBatch, event: ExpressionEvent) -> dict:
    return {
        "session_id": request.session_id,
        "user_id": request.user_id,
        "emotion": event.observed_expression,
        "confidence": event.signal_confidence,
        "secondary_emotion": None,
        "all_scores": event.expression_distribution,
        "face_detected": True,
        "source": "mobile_v2",
        "timestamp": event.ended_at.timestamp(),
    }


async def store_one_after_conflict(request: ExpressionEventBatch, event: ExpressionEvent) -> str:
    """Fallback raro para corrida entre dois lotes com o mesmo event_id."""
    existing = await database.fetch_one(
        sqlalchemy.select(vision_intervals.c.event_id).where(
            vision_intervals.c.event_id == event.event_id
        )
    )
    if existing is not None:
        return "duplicate"
    try:
        async with database.transaction():
            await database.execute(vision_intervals.insert().values(**interval_values(request, event)))
            if event.observed_expression != "unknown":
                await database.execute(
                    emotion_events.insert().values(**legacy_emotion_values(request, event))
                )
    except IntegrityError:
        return "duplicate"
    except Exception as exc:
        logger.error("V2 event storage failed | event_id=%s error=%s", event.event_id, type(exc).__name__)
        return "storage_error"
    return "accepted"


@router.post(
    "/expression-events:batch",
    response_model=ExpressionEventBatchResponse,
    summary="Store idempotent on-device expression intervals",
)
async def ingest_expression_events(request: ExpressionEventBatch):
    """Aceita somente sinais agregados; campos extras, inclusive frames, falham no schema."""
    accepted: list[str] = []
    duplicates: list[str] = []
    rejected: list[RejectedEvent] = []

    # Duplicados dentro do mesmo corpo sao tratados sem tocar o banco duas vezes.
    seen_in_request: set[str] = set()
    unique_events: list[ExpressionEvent] = []
    for event in request.events:
        if event.event_id in seen_in_request:
            duplicates.append(event.event_id)
            continue
        seen_in_request.add(event.event_id)
        unique_events.append(event)

    existing_rows = await database.fetch_all(
        sqlalchemy.select(vision_intervals.c.event_id).where(
            vision_intervals.c.event_id.in_([event.event_id for event in unique_events])
        )
    )
    existing_ids = {row["event_id"] for row in existing_rows}
    duplicates.extend(event.event_id for event in unique_events if event.event_id in existing_ids)
    candidates = [event for event in unique_events if event.event_id not in existing_ids]

    if candidates:
        try:
            # O caminho normal usa uma leitura e uma transacao por lote, nao por
            # evento. Isso mantem lotes de 50 dentro do budget sem perder UNIQUE.
            async with database.transaction():
                await database.execute_many(
                    query=vision_intervals.insert(),
                    values=[interval_values(request, event) for event in candidates],
                )
                legacy_values = [
                    legacy_emotion_values(request, event)
                    for event in candidates
                    if event.observed_expression != "unknown"
                ]
                if legacy_values:
                    await database.execute_many(query=emotion_events.insert(), values=legacy_values)
            accepted.extend(event.event_id for event in candidates)
        except IntegrityError:
            # Uma corrida concorrente reprocessa apenas este caminho excepcional.
            for event in candidates:
                outcome = await store_one_after_conflict(request, event)
                if outcome == "accepted":
                    accepted.append(event.event_id)
                elif outcome == "duplicate":
                    duplicates.append(event.event_id)
                else:
                    rejected.append(RejectedEvent(event_id=event.event_id, reason=outcome))
        except Exception as exc:
            logger.error(
                "V2 batch storage failed | session_id=%s error=%s",
                request.session_id,
                type(exc).__name__,
            )
            rejected.extend(
                RejectedEvent(event_id=event.event_id, reason="storage_error")
                for event in candidates
            )

    logger.info(
        "V2 batch | session_id=%s accepted=%s duplicate=%s rejected=%s",
        request.session_id,
        len(accepted),
        len(duplicates),
        len(rejected),
    )
    return ExpressionEventBatchResponse(
        accepted_event_ids=accepted,
        duplicate_event_ids=duplicates,
        rejected=rejected,
        server_time=datetime.now(UTC),
    )


@router.post("/expression-feedback", summary="Store idempotent expression feedback")
async def ingest_expression_feedback(request: ExpressionFeedbackRequest):
    existing_feedback = await database.fetch_one(
        sqlalchemy.select(vision_feedback.c.feedback_id).where(
            vision_feedback.c.feedback_id == request.feedback_id
        )
    )
    if existing_feedback is not None:
        return {"status": "duplicate", "feedback_id": request.feedback_id}

    event = await database.fetch_one(
        sqlalchemy.select(vision_intervals.c.event_id).where(
            vision_intervals.c.event_id == request.event_id
        )
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Expression event not found")

    try:
        await database.execute(
            vision_feedback.insert().values(
                feedback_id=request.feedback_id,
                event_id=request.event_id,
                agreement=request.agreement,
                self_reported_state=request.self_reported_state,
                corrected_observed_expression=request.corrected_observed_expression,
                note=request.note,
                created_at_ts=request.created_at.timestamp(),
            )
        )
    except IntegrityError:
        return {"status": "duplicate", "feedback_id": request.feedback_id}

    logger.info(
        "V2 feedback | feedback_id=%s event_id=%s agreement=%s",
        request.feedback_id,
        request.event_id,
        request.agreement,
    )
    return {"status": "accepted", "feedback_id": request.feedback_id}
