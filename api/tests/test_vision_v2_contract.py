"""Contrato, privacidade e idempotencia dos eventos visuais agregados V2."""
import asyncio
from datetime import UTC, datetime, timedelta

import databases
import pytest
import sqlalchemy
from pydantic import ValidationError

from routers import vision_v2
from utils.database import metadata, vision_feedback, vision_intervals


def make_event(event_id="01JTESTEVENT00000001"):
    started = datetime(2026, 8, 21, 13, 10, 2, tzinfo=UTC)
    return {
        "event_id": event_id,
        "kind": "transition",
        "started_at": started,
        "ended_at": started + timedelta(seconds=3),
        "duration_ms": 3000,
        "observed_expression": "happy",
        "expression_distribution": {
            "happy": 0.72,
            "neutral": 0.18,
            "surprised": 0.10,
        },
        "signal_confidence": 0.72,
        "quality": {"mean": 0.81, "accepted_coverage": 0.9, "reasons": []},
        "tension_signal": 0.12,
        "model_version": "expression-mobile@2.0.0",
        "pipeline_version": "vision-pipeline@2.0.0",
        "quality_config_version": "quality@1.0.0",
        "calibration_version": "personal-baseline@1",
        "source": "mobile",
    }


def make_batch(*events):
    return vision_v2.ExpressionEventBatch(
        session_id="01JTESTSESSION000001",
        device_session_id="01JTESTDEVICE0000001",
        user_id="01JTESTUSER000000001",
        events=list(events or [make_event()]),
    )


def test_schema_recusa_frame_e_classe_ansiosa():
    with pytest.raises(ValidationError):
        vision_v2.ExpressionEvent.model_validate({**make_event(), "frame_b64": "private"})
    with pytest.raises(ValidationError):
        vision_v2.ExpressionEvent.model_validate(
            {**make_event(), "observed_expression": "anxious"}
        )


def test_schema_exige_timestamp_com_timezone_e_distribuicao_normalizada():
    event = make_event()
    event["started_at"] = datetime(2026, 8, 21, 13, 10, 2)
    with pytest.raises(ValidationError):
        vision_v2.ExpressionEvent.model_validate(event)

    event = make_event()
    event["expression_distribution"] = {"happy": 0.4}
    with pytest.raises(ValidationError):
        vision_v2.ExpressionEvent.model_validate(event)


def test_batch_e_feedback_sao_idempotentes(tmp_path, monkeypatch):
    async def scenario():
        db_path = tmp_path / "vision-v2.db"
        url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
        sync_engine = sqlalchemy.create_engine(f"sqlite:///{db_path.as_posix()}")
        metadata.create_all(sync_engine)
        test_database = databases.Database(url)
        monkeypatch.setattr(vision_v2, "database", test_database)
        await test_database.connect()
        try:
            batch = make_batch(make_event())
            first = await vision_v2.ingest_expression_events(batch)
            second = await vision_v2.ingest_expression_events(batch)
            assert first.accepted_event_ids == ["01JTESTEVENT00000001"]
            assert second.duplicate_event_ids == ["01JTESTEVENT00000001"]

            interval_count = await test_database.fetch_val(
                sqlalchemy.select(sqlalchemy.func.count()).select_from(vision_intervals)
            )
            assert interval_count == 1

            feedback = vision_v2.ExpressionFeedbackRequest(
                feedback_id="01JTESTFEEDBACK00001",
                event_id="01JTESTEVENT00000001",
                agreement="no",
                self_reported_state="anxious",
                created_at=datetime.now(UTC),
            )
            assert (await vision_v2.ingest_expression_feedback(feedback))["status"] == "accepted"
            assert (await vision_v2.ingest_expression_feedback(feedback))["status"] == "duplicate"
            feedback_count = await test_database.fetch_val(
                sqlalchemy.select(sqlalchemy.func.count()).select_from(vision_feedback)
            )
            assert feedback_count == 1
        finally:
            await test_database.disconnect()
            sync_engine.dispose()

    asyncio.run(scenario())
