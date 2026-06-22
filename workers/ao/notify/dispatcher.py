"""Notification dispatcher.

Maps Event → NotificationPrefs → email / SMS / SSE. Channels degrade
gracefully when not configured (Gmail App Password missing, Twilio keys
missing) — the dispatcher writes an info row to agent_runs in either case
and keeps going.

The SSE broadcaster is an in-process pub/sub for the events endpoint —
process-local, fine for v1 (single backend process).
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import asdict

from ao.config import get_settings
from ao.db import models as m
from ao.db.engine import get_sessionmaker
from ao.integrations import gmail_smtp, twilio_client
from ao.logging import get_logger
from ao.notify.events import Event

log = get_logger(__name__)

# --- in-process broadcast for the SSE endpoint -----------------------------
_subscribers: set[asyncio.Queue[str]] = set()


async def subscribe() -> asyncio.Queue[str]:
    q: asyncio.Queue[str] = asyncio.Queue()
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue[str]) -> None:
    _subscribers.discard(q)


async def _broadcast(event: Event) -> None:
    msg = json.dumps({"type": event.type, "ticker": event.ticker, "payload": event.payload or {}})
    for q in list(_subscribers):
        try:
            q.put_nowait(msg)
        except Exception:
            pass


# --- channel dispatch -------------------------------------------------------
async def _channels_for(event: Event) -> tuple[bool, bool, str, str]:
    """Return (send_email, send_sms, email_to, phone_to) from the user's
    NotificationPrefs row — the same row the Settings screen writes to.
    """
    user_id = get_settings().user_id
    Session = get_sessionmaker()
    async with Session() as session:
        prefs = await session.get(m.NotificationPref, user_id)
    if prefs is None:
        return False, False, "", ""

    if event.type == "validated" and not prefs.on_validated:
        return False, False, "", ""
    if event.type == "review.added" and not prefs.on_review:
        return False, False, "", ""
    if event.type == "watching_started" and not prefs.on_watching_started:
        return False, False, "", ""
    if event.type == "budget_80" and not prefs.on_budget_80:
        return False, False, "", ""

    return prefs.email_enabled, prefs.sms_enabled, prefs.email, prefs.phone


def _split_recipients(s: str) -> list[str]:
    """Split a stored email/phone string into a list of recipients.

    Accepts comma-separated values; trims whitespace; drops empties.
    """
    if not s:
        return []
    return [part.strip() for part in s.split(",") if part.strip()]


def _subject_and_body(event: Event) -> tuple[str, str]:
    pl = event.payload or {}
    if event.type == "validated":
        subj = f"✓ {event.ticker} results validated"
        body = (
            f"{event.ticker} — new quarterly results were extracted and validated.\n"
            f"Period: {pl.get('period', '?')} · "
            f"Revenue: {pl.get('revenue', '?')} · "
            f"EPS diluted: {pl.get('eps_diluted', '?')}\n"
            "Open the app to see the full breakdown."
        )
    elif event.type == "review.added":
        subj = f"⚑ {event.ticker} — needs review"
        body = (
            f"{event.ticker} — {pl.get('field', '?')} couldn't be auto-validated.\n"
            f"Reason: {pl.get('reason', '?')}\n"
            "Open the Review Queue to decide."
        )
    elif event.type == "budget_80":
        subj = "Agent Orange — month spend hit 80%"
        body = f"This month: ${pl.get('cost', '?')} of ${pl.get('budget', '?')} budget."
    elif event.type == "watching_started":
        subj = f"👀 Watching window opened for {event.ticker}"
        body = f"{event.ticker} — predicted filing window has started."
    else:
        subj = f"Agent Orange — {event.type}"
        body = json.dumps(asdict(event), indent=2)
    return subj, body


async def dispatch(event: Event) -> None:
    """Send the event over all configured channels and broadcast to SSE."""
    log.info("notify.dispatch", event_type=event.type, ticker=event.ticker)

    # Always broadcast over SSE (the UI's live update path).
    await _broadcast(event)

    # User-channel decisions only apply to user-facing events.
    if event.type in ("company.updated", "run.progress"):
        return

    email_on, sms_on, email_to, phone_to = await _channels_for(event)
    if not email_on and not sms_on:
        return

    # Fall back to env-configured address only if the user hasn't set one in
    # the Settings screen. The prefs row is the source of truth.
    settings = get_settings()
    email_to = email_to or settings.user_email
    phone_to = phone_to or settings.user_phone

    subj, body = _subject_and_body(event)

    email_list = _split_recipients(email_to)
    phone_list = _split_recipients(phone_to)

    if email_on and email_list:
        for addr in email_list:
            try:
                await asyncio.to_thread(
                    gmail_smtp.send, to=addr, subject=subj, body_text=body,
                )
            except Exception as exc:
                log.warn("notify.email.send_failed", to=addr, error=str(exc))
    if sms_on and phone_list:
        for num in phone_list:
            try:
                await asyncio.to_thread(
                    twilio_client.send_sms, to=num, body=f"{subj}\n{body}",
                )
            except Exception as exc:
                log.warn("notify.sms.send_failed", to=num, error=str(exc))
