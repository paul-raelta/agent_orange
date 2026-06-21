from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_review_queue
from ao.db import models as m

router = APIRouter(prefix="/review-queue", tags=["review"])


@router.get("", response_model=list[s.ReviewItem])
async def list_review(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_review_queue(db, user_id)


@router.post("/{review_id}/resolve")
async def resolve_review(
    review_id: str,
    body: s.ResolveReviewRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = await db.get(m.ReviewItem, review_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(404, f"Unknown review item '{review_id}'")
    # For the Conflict workspace path, pinnedValue carries the chosen figure
    # (e.g. "$0.96") so it can be persisted alongside the abstract choice
    # ('A'|'B'|'flag'|'both-wrong'). The simple resolve path passes neither
    # and only the choice column is updated.
    row.resolved_choice = body.pinnedValue or body.choice
    row.resolved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    await db.commit()
    return {"id": review_id, "choice": body.choice}
