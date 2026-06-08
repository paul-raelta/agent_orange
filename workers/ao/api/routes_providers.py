from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_providers, serialize_routing
from ao.db import models as m

router = APIRouter(tags=["providers"])


@router.get("/providers", response_model=list[s.Provider])
async def list_providers(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_providers(db, user_id)


@router.get("/routing", response_model=list[s.RoutingRule])
async def get_routing(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_routing(db, user_id)


@router.put("/routing", response_model=list[s.RoutingRule])
async def put_routing(
    body: list[s.RoutingRule],
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    existing = {
        row.task: row for row in (await db.execute(
            select(m.RoutingRule).where(m.RoutingRule.user_id == user_id)
        )).scalars().all()
    }
    for rule in body:
        row = existing.get(rule.task)
        if row is None:
            db.add(m.RoutingRule(
                user_id=user_id, task=rule.task, desc=rule.desc, model=rule.model
            ))
        else:
            row.model = rule.model
            row.desc = rule.desc
    await db.commit()
    return await serialize_routing(db, user_id)
