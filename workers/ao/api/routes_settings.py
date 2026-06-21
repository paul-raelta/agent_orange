from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_feature_flags, serialize_notification_prefs
from ao.db import models as m

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/notifications", response_model=s.NotificationPrefs)
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_notification_prefs(db, user_id)


@router.put("/notifications", response_model=s.NotificationPrefs)
async def put_notifications(
    body: s.NotificationPrefs,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = await db.get(m.NotificationPref, user_id)
    if row is None:
        row = m.NotificationPref(user_id=user_id)
        db.add(row)
    row.email = body.email
    row.phone = body.phone
    row.email_enabled = body.emailEnabled
    row.sms_enabled = body.smsEnabled
    row.on_validated = body.onValidated
    row.on_review = body.onReview
    row.on_watching_started = body.onWatchingStarted
    row.on_budget_80 = body.onBudget80
    await db.commit()
    return await serialize_notification_prefs(db, user_id)


@router.get("/flags", response_model=s.FeatureFlags)
async def get_flags(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_feature_flags(db, user_id)


@router.put("/flags", response_model=s.FeatureFlags)
async def put_flags(
    body: s.FeatureFlags,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = await db.get(m.FeatureFlag, user_id)
    if row is None:
        row = m.FeatureFlag(user_id=user_id)
        db.add(row)
    row.consensus = bool(body.consensus)
    row.conflict = bool(body.conflict)
    row.guidance = bool(body.guidance)
    await db.commit()
    return await serialize_feature_flags(db, user_id)
