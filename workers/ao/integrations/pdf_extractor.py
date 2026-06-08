"""Page-aware PDF text + table extraction.

Output shape: a list of page dicts:
    [
      {"page": 1, "text": "...", "tables": [[[c11, c12, ...], [c21, ...]], ...]},
      ...
    ]

pdfplumber is the primary; pdfminer.six is the fallback when pdfplumber returns
no text (some IR PDFs are image-only). If both fail, the page text is empty —
the extraction agent will mark the metric `conf='low'` since no quote can be
verified.

Used by the extraction agent. Quote verification (programmatic substring check
on the cited page's text) lives there, not here.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pdfplumber
from pdfminer.high_level import extract_text as pdfminer_extract_text

from ao.logging import get_logger

log = get_logger(__name__)


@dataclass
class Page:
    page: int
    text: str
    tables: list[list[list[str]]]


def extract_pages(path: Path, *, max_pages: int = 60) -> list[Page]:
    """Read up to `max_pages` from a PDF. Returns one Page per source page."""
    out: list[Page] = []
    try:
        with pdfplumber.open(str(path)) as pdf:
            for i, page in enumerate(pdf.pages[:max_pages], start=1):
                text = page.extract_text() or ""
                tables_raw = page.extract_tables() or []
                tables: list[list[list[str]]] = []
                for t in tables_raw:
                    rows = [
                        [(c or "").strip() for c in row]
                        for row in t if row is not None
                    ]
                    tables.append(rows)
                out.append(Page(page=i, text=text, tables=tables))
    except Exception as exc:  # noqa: BLE001
        log.warning("pdf.pdfplumber_failed", path=str(path), error=str(exc))
        out = []

    # Fallback: pdfminer for plain text on pages where pdfplumber gave nothing.
    if not out or all(not p.text.strip() for p in out):
        log.info("pdf.fallback_pdfminer", path=str(path))
        try:
            text = pdfminer_extract_text(str(path), maxpages=max_pages) or ""
            # Heuristic page split — pdfminer doesn't expose page boundaries here,
            # but emits \f form-feeds between pages.
            pages_text = text.split("\f")
            out = [
                Page(page=i + 1, text=t, tables=[])
                for i, t in enumerate(pages_text[:max_pages])
            ]
        except Exception as exc:  # noqa: BLE001
            log.error("pdf.pdfminer_failed", path=str(path), error=str(exc))
            out = []

    return out


def page_text(pages: list[Page], page_num: int) -> str:
    """Return the text of one page, empty string if not found. Helper for
    the quote-verification step in extraction.py."""
    for p in pages:
        if p.page == page_num:
            return p.text
    return ""


def find_quote(pages: list[Page], quote: str) -> int | None:
    """Search every page for `quote` as a substring (case-insensitive,
    whitespace-normalized). Returns the page number that contains it, or None.
    Used to verify that an LLM-cited quote is real before persisting."""
    needle = " ".join(quote.lower().split())
    for p in pages:
        hay = " ".join(p.text.lower().split())
        if needle in hay:
            return p.page
    return None
