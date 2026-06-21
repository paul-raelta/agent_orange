from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_companies, serialize_company
from ao.data.sp500_seed import SP500_SEED
from ao.db import models as m
from ao.notify import dispatcher
from ao.notify.events import Event

router = APIRouter(prefix="/companies", tags=["companies"])

# ticker → seed row (name/sector/price/dayChange/mcap/earn/earnDays). Used by
# the batch-add path to populate a brand-new Company row before any agent
# discovery has run.
_SEED_BY_TICKER: dict[str, dict] = {row["ticker"]: row for row in SP500_SEED}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _load(db: AsyncSession, user_id: str, ticker: str) -> m.Company:
    row = (await db.execute(
        select(m.Company).where(
            m.Company.user_id == user_id, m.Company.ticker == ticker.upper()
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Unknown company '{ticker}'")
    return row


@router.get("", response_model=list[s.Company])
async def list_companies(
    archived: bool = Query(False, description="Return only archived companies"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_companies(db, user_id, archived=archived)


@router.post("/batch", response_model=list[s.Company])
async def add_companies_batch(
    body: s.BatchAddRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """START WATCHING ALL — bulk-create tracked Company rows from the
    Add Companies flow. Idempotent: tickers already tracked (active or
    archived) are skipped silently. `primaryIr[ticker]` pins the IR source
    URL for tickers where discovery surfaced multiple candidates."""
    existing = {
        t for (t,) in (await db.execute(
            select(m.Company.ticker).where(m.Company.user_id == user_id)
        )).all()
    }

    created_rows: list[m.Company] = []
    for raw in body.tickers:
        ticker = raw.strip().upper()
        if not ticker or ticker in existing:
            continue
        existing.add(ticker)

        seed = _SEED_BY_TICKER.get(ticker, {})
        name = seed.get("name") or ticker
        sector = seed.get("sector") or ""
        ir_url = (body.primaryIr or {}).get(ticker) or ""
        ir_label = (
            ir_url.replace("https://", "").replace("http://", "").rstrip("/")
            if ir_url else f"investors.{ticker.lower()}.com"
        )

        company = m.Company(
            user_id=user_id,
            ticker=ticker,
            name=name,
            sector=sector,
            currency="USD",
            cadence="Quarterly",
            fiscal_note="",
            status="watching",
            source_mode="auto",
            ir_url=ir_url or None,
        )
        db.add(company)
        await db.flush()  # assign company.id so Source FKs resolve

        db.add_all([
            m.Source(
                company_id=company.id, kind="IR",
                label=ir_label, url=ir_url or None, is_primary=True,
            ),
            m.Source(
                company_id=company.id, kind="SEC",
                label=f"EDGAR · search “{ticker}”",
            ),
        ])

        # Seed an initial Price row so portfolio math + the watchlist row
        # show a non-zero price until the price-refresh job catches up.
        seed_price = float(seed.get("price") or 0.0)
        seed_dc = float(seed.get("dayChange") or 0.0)
        if seed_price > 0:
            db.add(m.Price(
                company_id=company.id, ts=_now_iso(),
                price=seed_price, day_change=seed_dc,
            ))

        created_rows.append(company)

    if created_rows:
        await db.commit()
        for c in created_rows:
            await db.refresh(c)
        # SSE fan-out — UI invalidates companies + watchlist on each event.
        for c in created_rows:
            await dispatcher.dispatch(
                Event(type="company.updated", ticker=c.ticker)
            )

    return [await serialize_company(db, c) for c in created_rows]


@router.get("/{ticker}", response_model=s.Company)
async def get_company(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = await _load(db, user_id, ticker)
    return await serialize_company(db, row, include_news=True)


@router.patch("/{ticker}", response_model=s.Company)
async def patch_company(
    ticker: str,
    body: s.PatchCompanyRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Per-company config tweak. Today: IR URL (used by ir_fetcher).
    Add more editable fields as they're surfaced on the UI."""
    row = await _load(db, user_id, ticker)
    if body.irUrl is not None:
        url = body.irUrl.strip()
        if url and not (url.startswith("https://") or url.startswith("http://")):
            raise HTTPException(400, "irUrl must start with https:// or http://")
        row.ir_url = url or None
    await db.commit()
    await db.refresh(row)
    return await serialize_company(db, row, include_news=True)


@router.get("/{ticker}/guidance", response_model=list[s.GuidanceItem])
async def get_guidance(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Forward-guidance for one ticker. Gated on flags.guidance — when the
    flag is off this endpoint short-circuits to `[]` so the backend does no
    extraction work for a disabled feature."""
    from ao.api.serializers import serialize_feature_flags
    from ao.integrations.guidance_provider import guidance_for

    await _load(db, user_id, ticker)
    flags = await serialize_feature_flags(db, user_id)
    if not flags.guidance:
        return []
    return guidance_for(ticker)


@router.get("/{ticker}/sources", response_model=list[s.CompanyDataSource])
async def list_company_sources(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Effective source list for one company: every user-owned DataSource,
    annotated with the per-company override (if any)."""
    from ao.agents import source_registry

    row = await _load(db, user_id, ticker)
    await source_registry.ensure_builtins(db, user_id)
    sources = (await db.execute(
        select(m.DataSource)
        .where(m.DataSource.user_id == user_id)
        .order_by(m.DataSource.origin.desc(), m.DataSource.created_at)
    )).scalars().all()
    override_rows = (await db.execute(
        select(m.CompanySourceOverride).where(
            m.CompanySourceOverride.company_id == row.id
        )
    )).scalars().all()
    overrides = {ov.data_source_id: ov.enabled for ov in override_rows}
    return [
        s.CompanyDataSource(
            id=ds.id, sourceId=ds.source_id, name=ds.name, kind=ds.kind,  # type: ignore[arg-type]
            origin=ds.origin,  # type: ignore[arg-type]
            status=ds.status,  # type: ignore[arg-type]
            enabled=ds.enabled,
            effectiveEnabled=overrides.get(ds.id, ds.enabled),
            overridden=ds.id in overrides,
            baseUrl=ds.base_url, authLabel=ds.auth_label,
            authSecretRef=ds.auth_secret_ref,
            lastOkAt=ds.last_ok_at, lastError=ds.last_error,
        )
        for ds in sources
    ]


@router.patch("/{ticker}/sources/{data_source_id}", response_model=s.CompanyDataSource)
async def patch_company_source(
    ticker: str,
    data_source_id: str,
    body: s.PatchCompanySourceRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Set a per-company override on one DataSource — flips the effective
    enabled flag for this ticker without touching the global setting."""
    row = await _load(db, user_id, ticker)
    ds = (await db.execute(
        select(m.DataSource).where(
            m.DataSource.id == data_source_id,
            m.DataSource.user_id == user_id,
        )
    )).scalar_one_or_none()
    if ds is None:
        raise HTTPException(404, "Unknown data source")
    ov = (await db.execute(
        select(m.CompanySourceOverride).where(
            m.CompanySourceOverride.company_id == row.id,
            m.CompanySourceOverride.data_source_id == ds.id,
        )
    )).scalar_one_or_none()
    if ov is None:
        ov = m.CompanySourceOverride(
            company_id=row.id, data_source_id=ds.id, enabled=body.enabled,
        )
        db.add(ov)
    else:
        ov.enabled = body.enabled
        ov.updated_at = _now_iso()
    await db.commit()
    return s.CompanyDataSource(
        id=ds.id, sourceId=ds.source_id, name=ds.name, kind=ds.kind,  # type: ignore[arg-type]
        origin=ds.origin,  # type: ignore[arg-type]
        status=ds.status,  # type: ignore[arg-type]
        enabled=ds.enabled,
        effectiveEnabled=body.enabled,
        overridden=True,
        baseUrl=ds.base_url, authLabel=ds.auth_label,
        authSecretRef=ds.auth_secret_ref,
        lastOkAt=ds.last_ok_at, lastError=ds.last_error,
    )


@router.delete("/{ticker}/sources/{data_source_id}", status_code=204)
async def reset_company_source(
    ticker: str,
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Remove a per-company override — reverts the source to its global flag."""
    row = await _load(db, user_id, ticker)
    await db.execute(
        delete(m.CompanySourceOverride).where(
            m.CompanySourceOverride.company_id == row.id,
            m.CompanySourceOverride.data_source_id == data_source_id,
        )
    )
    await db.commit()


@router.post("/{ticker}/position", response_model=s.Company)
async def set_position(
    ticker: str,
    body: s.PositionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = await _load(db, user_id, ticker)
    row.shares = body.shares
    row.cost_basis = body.costBasis
    await db.commit()
    await db.refresh(row)
    return await serialize_company(db, row, include_news=True)


@router.post("/{ticker}/archive", response_model=s.Company)
async def archive_company(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Soft-delete: hide from watchlist, keep historical data. Idempotent."""
    row = await _load(db, user_id, ticker)
    if row.archived_at is None:
        row.archived_at = _now_iso()
        await db.commit()
        await db.refresh(row)
    return await serialize_company(db, row, include_news=True)


@router.post("/{ticker}/restore", response_model=s.Company)
async def restore_company(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Un-archive: bring back into the watchlist."""
    row = await _load(db, user_id, ticker)
    if row.archived_at is not None:
        row.archived_at = None
        await db.commit()
        await db.refresh(row)
    return await serialize_company(db, row, include_news=True)


@router.delete("/{ticker}", status_code=204)
async def delete_company(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Permanent purge. Requires the company to be archived first — a guard
    against accidental delete of an active watchlist row.

    Cascades to every table that FKs companies.id: sources (via ORM cascade)
    plus review_candidates → review_items → results (metrics cascade) →
    filings → provenance → prices → news → insider_tx → agent_runs.
    """
    if ticker.upper() == "NVDA":
        raise HTTPException(
            409,
            "NVDA is the demo anchor and can't be permanently deleted. Archive is allowed.",
        )
    row = await _load(db, user_id, ticker)
    if row.archived_at is None:
        raise HTTPException(
            409,
            f"Refusing to delete active company '{ticker}'. Archive it first.",
        )
    cid = row.id
    # Order matters: delete leaves before parents.
    result_ids = (await db.execute(
        select(m.Result.id).where(m.Result.company_id == cid)
    )).scalars().all()
    review_ids = (await db.execute(
        select(m.ReviewItem.id).where(m.ReviewItem.company_id == cid)
    )).scalars().all()
    if review_ids:
        await db.execute(
            delete(m.ReviewCandidate).where(m.ReviewCandidate.review_item_id.in_(review_ids))
        )
        await db.execute(delete(m.ReviewItem).where(m.ReviewItem.id.in_(review_ids)))
    if result_ids:
        await db.execute(delete(m.Metric).where(m.Metric.result_id.in_(result_ids)))
    await db.execute(delete(m.Provenance).where(m.Provenance.company_id == cid))
    await db.execute(delete(m.Result).where(m.Result.company_id == cid))
    await db.execute(delete(m.Filing).where(m.Filing.company_id == cid))
    await db.execute(delete(m.Price).where(m.Price.company_id == cid))
    await db.execute(delete(m.News).where(m.News.company_id == cid))
    await db.execute(delete(m.InsiderTx).where(m.InsiderTx.company_id == cid))
    await db.execute(delete(m.AgentRun).where(m.AgentRun.company_id == cid))
    # Source rows are ORM-cascaded via Company.sources relationship.
    await db.delete(row)
    await db.commit()
