"""Endpoints for the DATA SOURCES Settings panel.

GET    /api/v1/data-sources                  → list (built-ins + user-added)
PATCH  /api/v1/data-sources/{id}             → toggle / rename / update base_url
POST   /api/v1/data-sources                  → add a custom user source
DELETE /api/v1/data-sources/{id}             → remove (user-origin only)
POST   /api/v1/data-sources/{id}/test        → run the fetcher once, return preview
POST   /api/v1/source-suggestions            → submit a "please add X" wishlist row
GET    /api/v1/source-suggestions            → list user's submissions
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.agents import source_registry
from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import (
    serialize_data_source,
    serialize_data_sources,
    serialize_source_suggestion,
    serialize_source_suggestions,
)
from ao.db import models as m
from ao.integrations import generic_fetcher
from ao.util.safe_fetch import UnsafeURLError

router = APIRouter(tags=["sources"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------


@router.get("/data-sources", response_model=list[s.DataSource])
async def list_data_sources(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    await source_registry.ensure_builtins(db, user_id)
    return await serialize_data_sources(db, user_id)


@router.post("/data-sources", response_model=s.DataSource, status_code=201)
async def add_data_source(
    body: s.AddDataSourceRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    # Validate the URL up-front through the same SSRF guards the fetcher uses.
    # We don't actually fetch here — caller is expected to hit /test first.
    if not body.url.startswith("https://"):
        raise HTTPException(400, "URL must be https://")
    source_id = f"usr_{uuid4().hex[:12]}"
    row = m.DataSource(
        user_id=user_id, source_id=source_id, name=body.name.strip()[:80],
        kind=body.kind, origin="user", status="active", enabled=True,
        base_url=body.url, auth_label="No key",
    )
    db.add(row)
    await db.commit()
    return serialize_data_source(row)


@router.patch("/data-sources/{ds_id}", response_model=s.DataSource)
async def patch_data_source(
    ds_id: str, body: s.PatchDataSourceRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = (await db.execute(
        select(m.DataSource).where(
            m.DataSource.user_id == user_id, m.DataSource.id == ds_id,
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Source not found")
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.name is not None and row.origin == "user":
        row.name = body.name.strip()[:80]
    if body.baseUrl is not None and row.origin == "user":
        if not body.baseUrl.startswith("https://"):
            raise HTTPException(400, "URL must be https://")
        row.base_url = body.baseUrl
    row.updated_at = _now()
    await db.commit()
    return serialize_data_source(row)


@router.delete("/data-sources/{ds_id}", status_code=204)
async def delete_data_source(
    ds_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = (await db.execute(
        select(m.DataSource).where(
            m.DataSource.user_id == user_id, m.DataSource.id == ds_id,
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Source not found")
    if row.origin == "builtin":
        raise HTTPException(400, "Built-in sources can't be deleted — disable instead.")
    await db.delete(row)
    await db.commit()


@router.post("/data-sources/{ds_id}/test", response_model=s.TestDataSourceResult)
async def test_data_source(
    ds_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = (await db.execute(
        select(m.DataSource).where(
            m.DataSource.user_id == user_id, m.DataSource.id == ds_id,
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Source not found")
    if not row.base_url:
        raise HTTPException(400, "Source has no base URL to test")
    try:
        outcome = await generic_fetcher.fetch_url(row.base_url)
    except UnsafeURLError as exc:
        return s.TestDataSourceResult(
            ok=False, status=None, contentType="", preview="", error=str(exc),
        )
    # Heartbeat the row so the dot in the UI updates.
    await source_registry.record_fetch(
        db, user_id, row.source_id,
        ok=outcome.ok, error=outcome.error,
    )
    return s.TestDataSourceResult(
        ok=outcome.ok, status=outcome.status,
        contentType=outcome.content_type, preview=outcome.preview,
        error=outcome.error,
    )


# ---------------------------------------------------------------------------
# Source suggestions
# ---------------------------------------------------------------------------


@router.get("/source-suggestions", response_model=list[s.SourceSuggestion])
async def list_source_suggestions(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_source_suggestions(db, user_id)


@router.post(
    "/source-suggestions",
    response_model=s.SourceSuggestion,
    status_code=201,
)
async def create_source_suggestion(
    body: s.CreateSourceSuggestionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    if not body.url or len(body.url) > 2000:
        raise HTTPException(400, "URL is required (<= 2000 chars)")
    row = m.SourceSuggestion(
        user_id=user_id, url=body.url.strip(),
        ticker=(body.ticker or None),
        kind=(body.kind or None),
        note=(body.note or "")[:1000],
        status="submitted",
    )
    db.add(row)
    await db.commit()
    return serialize_source_suggestion(row)
