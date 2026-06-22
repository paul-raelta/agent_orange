from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_review_queue
from ao.db import models as m
from ao.notify import dispatcher
from ao.notify.events import Event

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

    # If this was the last open item for the company, clear its 'review'
    # status so the watchlist badge goes away. Resolving the user's decision
    # IS the validation outcome — the underlying Result row's flags are kept
    # as historical record. Fire SSE so cards refetch.
    company_id = row.company_id
    remaining = (await db.execute(
        select(func.count(m.ReviewItem.id)).where(
            m.ReviewItem.company_id == company_id,
            m.ReviewItem.resolved_at.is_(None),
            m.ReviewItem.id != row.id,
        )
    )).scalar_one()
    company = await db.get(m.Company, company_id) if company_id else None
    if remaining == 0 and company is not None and company.status == "review":
        company.status = "validated"
    await db.commit()

    if company is not None:
        await dispatcher.dispatch(Event(type="company.updated", ticker=company.ticker))
    return {"id": review_id, "choice": body.choice}
