"""Admin endpoints — destructive, idempotent operations the UI exposes to the
user. v1 has one: wipe fetched data and tracked companies so the UI looks
like a first-time experience.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ao.api.deps import current_user_id
from ao.db.wipe import wipe

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/wipe")
async def admin_wipe(_user_id: str = Depends(current_user_id)) -> dict:
    await wipe()
    return {"status": "ok"}
