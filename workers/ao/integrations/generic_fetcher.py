"""Generic HTTP fetcher for user-added data sources.

A user pastes a URL into the DATA SOURCES panel; we don't know how to parse
its payload semantically, but we can still fetch it, surface a sample, and
record successes / failures. Parsing real signal out of arbitrary feeds is a
later concern — this gives the seam without committing to a schema.

All HTTP traffic goes through ao.util.safe_fetch.safe_get so user-supplied
URLs can't be used as SSRF gadgets against internal services.
"""
from __future__ import annotations

from dataclasses import dataclass
import json

from ao.logging import get_logger
from ao.util.safe_fetch import FetchResult, UnsafeURLError, safe_get

log = get_logger(__name__)

MAX_PREVIEW_CHARS = 2000


@dataclass
class FetchOutcome:
    ok: bool
    status: int | None
    content_type: str
    preview: str       # first MAX_PREVIEW_CHARS of body (or parsed JSON head)
    error: str | None


async def fetch_url(
    url: str,
    *,
    headers: dict[str, str] | None = None,
) -> FetchOutcome:
    """Fetch `url`. Returns a FetchOutcome with a preview; never raises."""
    try:
        result: FetchResult = await safe_get(url, headers=headers)
    except UnsafeURLError as exc:
        return FetchOutcome(
            ok=False, status=None, content_type="",
            preview="", error=str(exc),
        )
    except Exception as exc:  # noqa: BLE001
        return FetchOutcome(
            ok=False, status=None, content_type="",
            preview="", error=f"{type(exc).__name__}: {exc}",
        )

    text = result.text()
    if "application/json" in result.content_type:
        try:
            parsed = json.loads(text)
            text = json.dumps(parsed, indent=2)
        except json.JSONDecodeError:
            pass
    preview = text[:MAX_PREVIEW_CHARS]
    if len(text) > MAX_PREVIEW_CHARS:
        preview += f"\n… (truncated, {len(text)} chars total)"
    ok = 200 <= result.status < 300
    return FetchOutcome(
        ok=ok, status=result.status, content_type=result.content_type,
        preview=preview,
        error=None if ok else f"HTTP {result.status}",
    )
