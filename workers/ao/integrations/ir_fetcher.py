"""Investor-relations site fetcher.

`fetch(url)` returns the readable text + the absolute URL of any obviously-
linked PDF on the page (10-Q, press release, results presentation, etc.).
Used by discovery (to scan an IR landing page) and by monitoring (to spot a
new press release before EDGAR has it).
"""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from lxml import html as lxml_html
from readability import Document  # readability-lxml

from ao.logging import get_logger

log = get_logger(__name__)


@dataclass
class IRFetchResult:
    url: str
    title: str
    text: str
    pdf_links: list[str]


async def fetch(url: str, *, timeout: float = 20.0) -> IRFetchResult:
    """GET a URL, extract main content + any PDF hrefs."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        r = await client.get(url, headers={"User-Agent": "Agent Orange"})
        r.raise_for_status()

    doc = Document(r.text)
    title = (doc.title() or "").strip()
    summary_html = doc.summary()
    text_tree = lxml_html.fromstring(summary_html)
    text = text_tree.text_content().strip()

    full_tree = lxml_html.fromstring(r.text)
    pdf_links: list[str] = []
    for a in full_tree.xpath("//a[@href]"):
        href = a.get("href")
        if not href:
            continue
        if href.lower().endswith(".pdf"):
            pdf_links.append(urljoin(url, href))

    return IRFetchResult(
        url=str(r.url), title=title, text=text[:20_000], pdf_links=pdf_links[:20]
    )


def origin(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"
