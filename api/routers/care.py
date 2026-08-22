"""
Care Router — vínculo entre cuidador e pessoa cuidada.

Fluxo: o cuidador gera um invite_code (status "pending", sem cared_user_id).
A pessoa cuidada resgata o código com o próprio user_id, o que preenche
cared_user_id e vira "accepted". Só a partir daí o cuidador pode consultar
os dados agregados dessa pessoa (via /api/v1/dashboard, /api/v1/history,
que já aceitam user_id).
"""
import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from utils.database import caregiver_links, database, users
from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)

CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code() -> str:
    return "MEL-" + "".join(random.choices(CODE_ALPHABET, k=4))


class InviteRequest(BaseModel):
    caregiver_user_id: str = Field(min_length=1, max_length=36)
    cared_name: Optional[str] = Field(default=None, max_length=120)
    relationship: Optional[str] = Field(default=None, max_length=64)
    scopes: Optional[dict] = None


class AcceptRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=16)
    user_id: str = Field(min_length=1, max_length=36)


@router.post("/invite", summary="Create a caregiver invite code", status_code=201)
async def create_invite(payload: InviteRequest):
    # Poucas tentativas bastam: 32^4 combinacoes, colisao e rara.
    for _ in range(5):
        code = _generate_code()
        existing = await database.fetch_one(
            caregiver_links.select().where(caregiver_links.c.invite_code == code)
        )
        if not existing:
            break
    else:
        raise HTTPException(status_code=503, detail="Não foi possível gerar um código, tente de novo")

    await database.execute(
        caregiver_links.insert().values(
            invite_code=code,
            caregiver_user_id=payload.caregiver_user_id,
            cared_name=payload.cared_name,
            relationship=payload.relationship,
            scopes=payload.scopes,
            status="pending",
        )
    )
    row = await database.fetch_one(
        caregiver_links.select().where(caregiver_links.c.invite_code == code)
    )
    return dict(row)


@router.post("/accept", summary="Redeem a caregiver invite code")
async def accept_invite(payload: AcceptRequest):
    code = payload.invite_code.strip().upper()
    row = await database.fetch_one(
        caregiver_links.select().where(caregiver_links.c.invite_code == code)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Código inválido")
    if row["status"] == "accepted":
        raise HTTPException(status_code=409, detail="Código já foi usado")
    if row["caregiver_user_id"] == payload.user_id:
        raise HTTPException(status_code=422, detail="Você não pode aceitar seu próprio convite")

    await database.execute(
        caregiver_links.update()
        .where(caregiver_links.c.invite_code == code)
        .values(cared_user_id=payload.user_id, status="accepted", accepted_at=datetime.now(timezone.utc))
    )
    updated = await database.fetch_one(
        caregiver_links.select().where(caregiver_links.c.invite_code == code)
    )
    return dict(updated)


@router.get("/links", summary="List a user's caregiver links (as caregiver or as cared-for)")
async def list_links(
    user_id: str = Query(..., min_length=1, max_length=36),
    role: str = Query(..., pattern="^(care|user)$"),
):
    column = caregiver_links.c.caregiver_user_id if role == "care" else caregiver_links.c.cared_user_id
    rows = await database.fetch_all(
        caregiver_links.select()
        .where(column == user_id)
        .where(caregiver_links.c.status == "accepted")
        .order_by(caregiver_links.c.accepted_at.desc())
    )
    links = [dict(r) for r in rows]

    if role == "user":
        # cared_name já vem preenchido pelo cuidador no convite; mas quem
        # cuida só existe como UUID no vínculo — sem isso a tela mostraria
        # um UUID cru em vez de um identificador legível.
        caregiver_ids = {link["caregiver_user_id"] for link in links}
        if caregiver_ids:
            caregiver_rows = await database.fetch_all(
                users.select().where(users.c.id.in_(caregiver_ids))
            )
            by_id = {row["id"]: row for row in caregiver_rows}
            for link in links:
                caregiver = by_id.get(link["caregiver_user_id"])
                link["caregiver_email"] = caregiver["email"] if caregiver else None
                link["caregiver_display_name"] = caregiver["display_name"] if caregiver else None

    return {"links": links, "count": len(links)}


@router.delete("/links/{link_id}", summary="Remove a caregiver link")
async def delete_link(link_id: int, user_id: str = Query(..., min_length=1, max_length=36)):
    row = await database.fetch_one(caregiver_links.select().where(caregiver_links.c.id == link_id))
    if not row or user_id not in (row["caregiver_user_id"], row["cared_user_id"]):
        raise HTTPException(status_code=404, detail="Vínculo não encontrado")
    await database.execute(caregiver_links.delete().where(caregiver_links.c.id == link_id))
    return {"deleted": True}
