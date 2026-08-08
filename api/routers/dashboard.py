"""
Dashboard Router — Analytics and AI-powered emotional insights
"""
import time
from typing import Optional

from fastapi import APIRouter, Query

from routers.history import require_scope
from services.ai_service import ai_chat_service
from utils.database import database, emotion_events
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


@router.get("/overview", summary="Full dashboard overview")
async def get_dashboard(
    user_id: Optional[str] = Query(None, max_length=64),
    session_id: Optional[str] = Query(None, max_length=64),
    hours: int = Query(24, ge=1, le=168),
):
    """
    Complete dashboard data: timeline, heatmap, dominant moods, and AI insight."""
    require_scope(session_id, user_id)
    since = time.time() - (hours * 3600)

    query = emotion_events.select().where(emotion_events.c.timestamp >= since)
    if user_id:
        query = query.where(emotion_events.c.user_id == user_id)
    if session_id:
        query = query.where(emotion_events.c.session_id == session_id)
    query = query.order_by(emotion_events.c.timestamp.asc())

    rows = await database.fetch_all(query)
    events = [dict(r) for r in rows]

    if not events:
        return {
            "period_hours": hours,
            "total_events": 0,
            "timeline": [],
            "emotion_distribution": {},
            "hourly_heatmap": {},
            "peak_emotions": [],
            "ai_insight": "Sem dados ainda. Comece a usar o MellowPet para ver seus insights! ",
            "wellbeing_score": None,
        }

    # Build hourly buckets for timeline
    hourly: dict[int, dict[str, int]] = {}
    emotion_counts: dict[str, int] = {}

    for e in events:
        h = int((e["timestamp"] - since) // 3600)
        hourly.setdefault(h, {})
        em = e["emotion"]
        hourly[h][em] = hourly[h].get(em, 0) + 1
        emotion_counts[em] = emotion_counts.get(em, 0) + 1

    total = len(events)
    emotion_pct = {k: round(v / total * 100, 1) for k, v in emotion_counts.items()}

    # Wellbeing score (0-100)
    positive_pct = sum(
        emotion_pct.get(e, 0) for e in ["happy", "surprised"]
    )
    negative_pct = sum(
        emotion_pct.get(e, 0) for e in ["sad", "angry", "anxious", "disgusted"]
    )
    wellbeing = round(50 + (positive_pct - negative_pct) * 0.5, 1)
    wellbeing = max(0, min(100, wellbeing))

    # Timeline for chart
    timeline = [
        {"hour": h, "emotions": hourly[h], "total": sum(hourly[h].values())}
        for h in sorted(hourly.keys())
    ]

    # AI Insight
    summary = {
        "dominant": max(emotion_counts, key=emotion_counts.get),
        "distribution": emotion_pct,
        "wellbeing_score": wellbeing,
        "total_readings": total,
    }
    ai_insight, ai_provider = await ai_chat_service.generate_insight(summary, f"nas últimas {hours}h")

    return {
        "period_hours": hours,
        "total_events": total,
        "timeline": timeline,
        "emotion_distribution": emotion_pct,
        "emotion_counts": emotion_counts,
        "wellbeing_score": wellbeing,
        "peak_emotions": sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:3],
        "ai_insight": ai_insight,
        "ai_provider": ai_provider,
    }
