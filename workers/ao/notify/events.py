"""Event types published by the pipeline / scheduler.

The dispatcher maps events → NotificationPrefs → channels. The SSE endpoint
broadcasts to the UI for live updates.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

EventType = Literal[
    "company.updated",
    "review.added",
    "validated",
    "watching_started",
    "budget_80",
    "run.progress",
]


@dataclass
class Event:
    type: EventType
    ticker: str | None = None
    payload: dict | None = None
