"""Twilio SMS wrapper.

`send_sms(to, body)` posts a Twilio Message. Bodies cap at ~320 chars (two
SMS segments). The dispatcher renders the body from the same template
context as the email so the user sees a consistent message across channels.

If TWILIO_* env vars are missing, `send_sms()` returns False without raising.
"""
from __future__ import annotations

from twilio.rest import Client

from ao.config import get_settings
from ao.logging import get_logger

log = get_logger(__name__)

_client: Client | None = None


def is_configured() -> bool:
    s = get_settings()
    return bool(s.twilio_account_sid and s.twilio_auth_token and s.twilio_from)


def _get_client() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = Client(s.twilio_account_sid, s.twilio_auth_token)
    return _client


def send_sms(*, to: str, body: str) -> bool:
    if not is_configured():
        log.warning("twilio.not_configured", to=to)
        return False
    if not to:
        log.warning("twilio.no_recipient")
        return False

    settings = get_settings()
    body = body[:320]
    try:
        msg = _get_client().messages.create(from_=settings.twilio_from, to=to, body=body)
        log.info("twilio.sent", sid=msg.sid, to=to)
        return True
    except Exception as exc:  # noqa: BLE001
        log.error("twilio.send_failed", error=str(exc))
        return False
