"""Helper for writing the agent_runs + usage_daily rows around any pipeline
stage. Pulled out so every stage has identical bookkeeping.

Usage:
    async with run_log(session, user_id, "NVDA", stage="extract") as rec:
        ... do work ...
        rec.set(level="ok", message="Extracted 5 metrics", model="claude-opus-4-7",
                input_tokens=12000, output_tokens=800, cost_usd=0.42)
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.db import models as m


@dataclass
class _Record:
    level: str = "info"
    message: str = ""
    model: str | None = None
    prompt_version: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    extras: dict = field(default_factory=dict)

    def set(self, **kwargs) -> None:
        for k, v in kwargs.items():
            setattr(self, k, v)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@asynccontextmanager
async def run_log(
    session: AsyncSession, user_id: str, agent: str, *,
    stage: str, company_id: str | None = None,
):
    started_at = _now_iso()
    started_mono = datetime.now(timezone.utc)
    rec = _Record()
    try:
        yield rec
    finally:
        finished = datetime.now(timezone.utc)
        duration_ms = int((finished - started_mono).total_seconds() * 1000)

        session.add(m.AgentRun(
            id=uuid4().hex,
            user_id=user_id, company_id=company_id,
            agent=agent, stage=stage,
            level=rec.level, message=rec.message,
            model=rec.model, prompt_version=rec.prompt_version,
            input_tokens=rec.input_tokens, output_tokens=rec.output_tokens,
            cost_usd=rec.cost_usd,
            started_at=started_at,
            finished_at=finished.isoformat(timespec="seconds"),
            duration_ms=duration_ms,
        ))
        if rec.input_tokens or rec.output_tokens:
            day = _today()
            # Upsert usage_daily for this (day, model, stage).
            existing = (await session.execute(
                select(m.UsageDaily).where(
                    m.UsageDaily.user_id == user_id,
                    m.UsageDaily.day == day,
                    m.UsageDaily.model == (rec.model or "?"),
                    m.UsageDaily.task == stage,
                )
            )).scalar_one_or_none()
            if existing is None:
                session.add(m.UsageDaily(
                    id=uuid4().hex, user_id=user_id,
                    day=day, model=rec.model or "?", task=stage,
                    input_tokens=rec.input_tokens, output_tokens=rec.output_tokens,
                    cost_usd=rec.cost_usd, runs=1,
                ))
            else:
                existing.input_tokens += rec.input_tokens
                existing.output_tokens += rec.output_tokens
                existing.cost_usd += rec.cost_usd
                existing.runs += 1
        await session.commit()
