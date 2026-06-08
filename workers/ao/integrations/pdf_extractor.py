"""Document → page-aware text extraction.

Despite the name (kept for backwards-compat), this module handles BOTH PDF
and HTML inputs — SEC EDGAR's 10-Q/10-K primary docs are usually .htm files,
and we want one extraction path regardless of source.

Output shape: a list of `Page` objects:
    [Page(page=1, text="...", tables=[[[c11, c12, ...], ...]]), ...]

For PDFs: pdfplumber is primary, pdfminer.six is fallback for image-only PDFs.
For HTML: lxml.text_content() flattens the DOM (inline tables included), then
we chunk into ~3000-char pseudo-pages so the LLM can cite a "page" number.
The page number is synthetic but stable — quote verification reads the same
chunk back to confirm.

Quote verification (programmatic substring check on the cited page's text)
lives in extraction.py, not here.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import pdfplumber
from lxml import html as lxml_html
from pdfminer.high_level import extract_text as pdfminer_extract_text

from ao.logging import get_logger

log = get_logger(__name__)

# Pseudo-page size for HTML inputs. ~3000 chars is a typical PDF page's text
# density, so synthetic page citations feel familiar to the model.
HTML_CHUNK_CHARS = 3000


@dataclass
class Page:
    page: int
    text: str
    tables: list[list[list[str]]]


def _looks_like_html(path: Path) -> bool:
    """Cheap dispatch: extension first, then content sniff (first 512 bytes)."""
    suffix = path.suffix.lower()
    if suffix in {".htm", ".html"}:
        return True
    if suffix == ".pdf":
        return False
    try:
        with open(path, "rb") as f:
            head = f.read(512).lower()
        return b"<html" in head or b"<!doctype html" in head
    except Exception:
        return False


def _extract_html_pages(path: Path, *, max_pages: int) -> list[Page]:
    """HTML → list of pseudo-pages.

    Strategy: strip <script>/<style>, take text_content() of the whole body
    (which flattens table cells inline with whitespace — fine for number
    extraction), normalize whitespace, then chunk into ~3000-char pages
    preferring newline boundaries.
    """
    # lxml rejects unicode strings that include an XML encoding declaration
    # (which SEC filings often have) — feed bytes instead.
    raw = path.read_bytes()
    try:
        tree = lxml_html.fromstring(raw)
    except Exception as exc:  # noqa: BLE001
        log.warning("html.parse_failed", path=str(path), error=str(exc))
        return []

    for tag in ("script", "style"):
        for el in tree.xpath(f"//{tag}"):
            el.drop_tree()

    text = tree.text_content()
    # Normalize: collapse runs of whitespace, keep paragraph breaks.
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n[ \t]*\n[ \t]*\n+", "\n\n", text)
    text = text.strip()

    pages: list[Page] = []
    pos = 0
    page_num = 1
    while pos < len(text) and page_num <= max_pages:
        end = min(pos + HTML_CHUNK_CHARS, len(text))
        # Prefer a newline boundary if one's within the second half of the chunk.
        if end < len(text):
            nl = text.rfind("\n", pos + HTML_CHUNK_CHARS // 2, end)
            if nl > pos:
                end = nl
        pages.append(Page(page=page_num, text=text[pos:end].strip(), tables=[]))
        pos = end
        page_num += 1

    log.info("html.extracted", path=str(path), pages=len(pages), chars=len(text))
    return pages


def _extract_pdf_pages(path: Path, *, max_pages: int) -> list[Page]:
    """PDF → page-by-page text + tables via pdfplumber, with pdfminer fallback."""
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

    if not out or all(not p.text.strip() for p in out):
        log.info("pdf.fallback_pdfminer", path=str(path))
        try:
            text = pdfminer_extract_text(str(path), maxpages=max_pages) or ""
            pages_text = text.split("\f")
            out = [
                Page(page=i + 1, text=t, tables=[])
                for i, t in enumerate(pages_text[:max_pages])
            ]
        except Exception as exc:  # noqa: BLE001
            log.error("pdf.pdfminer_failed", path=str(path), error=str(exc))
            out = []
    return out


def extract_pages(path: Path, *, max_pages: int = 60) -> list[Page]:
    """Dispatch on file type and return a list of Pages, capped at `max_pages`."""
    if _looks_like_html(path):
        return _extract_html_pages(path, max_pages=max_pages)
    return _extract_pdf_pages(path, max_pages=max_pages)


def page_text(pages: list[Page], page_num: int) -> str:
    for p in pages:
        if p.page == page_num:
            return p.text
    return ""


def find_quote(pages: list[Page], quote: str) -> int | None:
    """Search every page for `quote` as a substring (case-insensitive,
    whitespace-normalized). Returns the page number that contains it, or None.
    Used to verify that an LLM-cited quote is real before persisting."""
    needle = " ".join(quote.lower().split())
    if not needle:
        return None
    for p in pages:
        hay = " ".join(p.text.lower().split())
        if needle in hay:
            return p.page
    return None
