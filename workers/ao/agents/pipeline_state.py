"""In-memory tracker for which company pipelines are currently running.

The pipeline writes AgentRun rows AFTER each stage completes — there's no
persisted record of "this ticker is mid-extraction right now." This module
fills that gap so the watchlist can show a REFRESHING indicator while
RUN ALL AGENTS is processing the user's tickers in the background.

State lives in two module-level dicts (process-local, intentionally — fine
for the v1 single-process deploy where api + scheduler share a process):

- `_running`: (user_id, ticker) → started_at datetime
- `_queue`:   user_id → ordered list of tickers waiting to start

When the api process restarts, the tracker resets to empty. That's correct
behavior — any in-flight pipeline was killed with the process, so its row
isn't "running" anymore.

`DEFAULT_BUDGET_SECONDS` is a rough estimate of how long the full pipeline
(monitor → extract → validate → narrative → confidence) takes per ticker.
Used to compute ETAs for the UI; the indicator clamps to zero if the real
run overshoots.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TypedDict

DEFAULT_BUDGET_SECONDS = 75

_running: dict[tuple[str, str], datetime] = {}
_queue: dict[str, list[str]] = {}


class PipelineStatus(TypedDict, total=False):
    state: str  # "running" | "queued"
    startedAt: str
    etaRemainingSeconds: int


def _now() -> datetime:
    return datetime.now(timezone.utc)


def queue_tickers(user_id: str, tickers: list[str]) -> None:
    """Add tickers to the user's pending queue. Idempotent — already-queued
    or currently-running tickers are skipped."""
    q = _queue.setdefault(user_id, [])
    for t in tickers:
        if t in q or (user_id, t) in _running:
            continue
        q.append(t)


def mark_started(user_id: str, ticker: str) -> None:
    """Flip a ticker from queued (or absent) to running."""
    _running[(user_id, ticker)] = _now()
    q = _queue.get(user_id)
    if q and ticker in q:
        q.remove(ticker)


def mark_finished(user_id: str, ticker: str) -> None:
    """Remove a ticker from the tracker entirely."""
    _running.pop((user_id, ticker), None)
    q = _queue.get(user_id)
    if q and ticker in q:
        q.remove(ticker)
    if q is not None and not q and not any(
        u == user_id for (u, _t) in _running
    ):
        _queue.pop(user_id, None)


def status_for(user_id: str, ticker: str) -> PipelineStatus | None:
    """Current status for one (user, ticker), or None if idle."""
    started = _running.get((user_id, ticker))
    if started is not None:
        elapsed = (_now() - started).total_seconds()
        remaining = max(0, DEFAULT_BUDGET_SECONDS - int(elapsed))
        return PipelineStatus(
            state="running",
            startedAt=started.isoformat(timespec="seconds"),
            etaRemainingSeconds=remaining,
        )
    queue = _queue.get(user_id, [])
    if ticker in queue:
        # ETA = remaining time on the currently-running ticker (if any) +
        # one full budget per queue slot ahead of this one.
        position = queue.index(ticker)
        active_remaining = 0
        active_starts = [
            v for (u, _), v in _running.items() if u == user_id
        ]
        if active_starts:
            elapsed = (_now() - min(active_starts)).total_seconds()
            active_remaining = max(0, DEFAULT_BUDGET_SECONDS - int(elapsed))
        eta = active_remaining + position * DEFAULT_BUDGET_SECONDS
        return PipelineStatus(state="queued", etaRemainingSeconds=eta)
    return None


def clear_user(user_id: str) -> None:
    """Drop every entry for a user — used by tests and as a defensive reset."""
    for key in [k for k in _running if k[0] == user_id]:
        _running.pop(key, None)
    _queue.pop(user_id, None)
