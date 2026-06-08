"""Admin endpoints — destructive, idempotent operations the UI exposes to the
user. v1 has one: wipe fetched data so the UI looks like a first-time
experience.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ao.api.deps import current_user_id
from ao.db.wipe import wipe

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/wipe")
async def admin_wipe(
    reseed_demo_review: bool = True,
    _user_id: str = Depends(current_user_id),
) -> dict:
    await wipe(reseed_demo_review=reseed_demo_review)
    return {"status": "ok", "reseeded_demo_review": reseed_demo_review}
