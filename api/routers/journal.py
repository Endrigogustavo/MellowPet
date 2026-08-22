"""
Journal Router — entradas de diário emocional, persistidas por usuário.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from utils.database import database, journal_entries
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


class JournalCreateRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)
    text: str = Field(min_length=1, max_length=2000)
    tag: Optional[str] = Field(default=None, max_length=64)


@router.post("/", summary="Create a journal entry", status_code=201)
async def create_entry(payload: JournalCreateRequest):
    entry_id = str(uuid.uuid4())
    await database.execute(
        journal_entries.insert().values(
            entry_id=entry_id,
            user_id=payload.user_id,
            text=payload.text,
            tag=payload.tag,
        )
    )
    row = await database.fetch_one(
        journal_entries.select().where(journal_entries.c.entry_id == entry_id)
    )
    return dict(row)


@router.get("/", summary="List journal entries for a user")
async def list_entries(
    user_id: str = Query(..., min_length=1, max_length=36),
    limit: int = Query(50, ge=1, le=200),
):
    rows = await database.fetch_all(
        journal_entries.select()
        .where(journal_entries.c.user_id == user_id)
        .order_by(journal_entries.c.created_at.desc())
        .limit(limit)
    )
    return {"entries": [dict(r) for r in rows], "count": len(rows)}


@router.delete("/{entry_id}", summary="Delete a journal entry")
async def delete_entry(entry_id: str, user_id: str = Query(..., min_length=1, max_length=36)):
    row = await database.fetch_one(
        journal_entries.select().where(journal_entries.c.entry_id == entry_id)
    )
    if not row or row["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Entrada não encontrada")
    await database.execute(
        journal_entries.delete().where(journal_entries.c.entry_id == entry_id)
    )
    return {"deleted": True}
