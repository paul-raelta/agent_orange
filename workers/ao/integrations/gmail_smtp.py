"""Gmail SMTP wrapper.

Uses smtplib.SMTP_SSL on port 465 with a Google App Password (16-char
generated at https://myaccount.google.com/apppasswords). Set GMAIL_USER and
GMAIL_APP_PASSWORD in workers/.env to enable.

If the App Password isn't set, `send()` returns False without raising — the
dispatcher logs a one-line warning and the other channels keep working.
"""
from __future__ import annotations

import smtplib
from email.message import EmailMessage

from ao.config import get_settings
from ao.logging import get_logger

log = get_logger(__name__)


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.gmail_user and settings.gmail_app_password)


def send(*, to: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    if not is_configured():
        log.warning("gmail.not_configured", to=to, subject=subject)
        return False

    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = settings.gmail_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.send_message(msg)
        log.info("gmail.sent", to=to, subject=subject)
        return True
    except Exception as exc:  # noqa: BLE001
        log.error("gmail.send_failed", error=str(exc))
        return False
