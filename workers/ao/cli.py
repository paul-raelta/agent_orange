"""ao CLI — operator surface for seed, run, poll, integration smoke tests.

Usage:
    ao seed [TICKER]
    ao run TICKER                    # one full pipeline pass against the cached filing
    ao poll TICKER                   # monitoring stage only
    ao extract TICKER PDF_PATH       # extract one local PDF without touching DB
    ao notify-test (email|sms)       # send a test notification
    ao finnhub-test TICKER           # quote + recent news + insider tx
    ao edgar-test CIK                # fetch EDGAR submissions JSON
    ao ir-test URL                   # fetch an IR page + list any PDF links
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import typer

from ao.config import ensure_var_dirs, get_settings
from ao.logging import setup_logging

app = typer.Typer(help="Agent Orange operator CLI", no_args_is_help=True)


@app.callback()
def _root() -> None:
    setup_logging(get_settings().log_level)
    ensure_var_dirs()


@app.command()
def seed(ticker: str = typer.Argument(None, help="Only seed this ticker; default = all")) -> None:
    """Reset + seed the local DB (NVDA + SNDK + MU by default)."""
    from ao.db.seed import seed_all
    asyncio.run(seed_all(ticker.upper() if ticker else None))


@app.command(name="finnhub-test")
def finnhub_test(ticker: str) -> None:
    """Live smoke test of the Finnhub client. Prints quote + a sample of recent news + insider."""
    from ao.integrations import finnhub_client

    async def _run() -> None:
        q = await finnhub_client.quote(ticker.upper())
        typer.echo(f"QUOTE: {json.dumps(q, indent=2)}")
        news = await finnhub_client.company_news(ticker.upper(), days=7)
        typer.echo(f"NEWS ({len(news)} items, last 7d):")
        for n in news[:3]:
            typer.echo(f"  - {n.get('headline', '')[:80]}")
        ins = await finnhub_client.insider_transactions(ticker.upper())
        typer.echo(f"INSIDER ({len(ins)} items):")
        for tx in ins[:3]:
            typer.echo(f"  - {tx.get('name', '?')} {tx.get('transactionCode', '')} {tx.get('share', 0)} @ {tx.get('transactionPrice', 0)}")

    asyncio.run(_run())


@app.command(name="edgar-test")
def edgar_test(cik: str) -> None:
    """Fetch EDGAR submissions JSON for a CIK and print recent filings."""
    from ao.integrations import edgar_client

    async def _run() -> None:
        data = await edgar_client.submissions(cik)
        typer.echo(f"name: {data.get('name')}")
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])[:8]
        dates = recent.get("filingDate", [])[:8]
        accs = recent.get("accessionNumber", [])[:8]
        for f, d, a in zip(forms, dates, accs):
            typer.echo(f"  {d}  {f:8}  {a}")

    asyncio.run(_run())


@app.command(name="ir-test")
def ir_test(url: str) -> None:
    """Fetch one IR-site URL and list PDF links found."""
    from ao.integrations import ir_fetcher

    async def _run() -> None:
        r = await ir_fetcher.fetch(url)
        typer.echo(f"title: {r.title}")
        typer.echo(f"pdfs ({len(r.pdf_links)}):")
        for p in r.pdf_links[:8]:
            typer.echo(f"  - {p}")

    asyncio.run(_run())


@app.command(name="notify-test")
def notify_test(channel: str = typer.Argument(..., help="email or sms")) -> None:
    """Send a test message on the chosen channel."""
    settings = get_settings()
    if channel == "email":
        from ao.integrations import gmail_smtp
        ok = gmail_smtp.send(
            to=settings.user_email,
            subject="Agent Orange — test email",
            body_text="If you're seeing this, the email channel works.",
        )
        typer.echo("sent" if ok else "FAILED (check GMAIL_USER + GMAIL_APP_PASSWORD)")
    elif channel == "sms":
        from ao.integrations import twilio_client
        ok = twilio_client.send_sms(
            to=settings.user_phone,
            body="Agent Orange — SMS channel test.",
        )
        typer.echo("sent" if ok else "FAILED (check TWILIO_*)")
    else:
        typer.echo(f"Unknown channel '{channel}'. Use email or sms.")
        raise typer.Exit(code=1)


@app.command()
def extract(_ticker: str, pdf_path: str) -> None:
    """Extract pages from a PDF and print sample tables (no LLM)."""
    from ao.integrations import pdf_extractor

    pages = pdf_extractor.extract_pages(Path(pdf_path))
    typer.echo(f"{len(pages)} pages extracted from {pdf_path}")
    for p in pages[:3]:
        typer.echo(f"--- page {p.page} ({len(p.text)} chars, {len(p.tables)} tables) ---")
        typer.echo(p.text[:300] + ("..." if len(p.text) > 300 else ""))


@app.command()
def run(ticker: str) -> None:
    """Run the full pipeline once for TICKER (monitor → extract → validate → narrative)."""
    from ao.agents.pipeline import run_one
    from ao.db.engine import get_engine, get_sessionmaker

    async def _go() -> None:
        Session = get_sessionmaker()
        async with Session() as session:
            await run_one(session, get_settings().user_id, ticker)
        await get_engine().dispose()

    asyncio.run(_go())


@app.command()
def poll(ticker: str) -> None:
    """Run the monitoring stage only — checks EDGAR for new filings."""
    from ao.agents.monitoring import poll_company
    from ao.db.engine import get_engine, get_sessionmaker
    from sqlalchemy import select
    from ao.db import models as m

    async def _go() -> None:
        Session = get_sessionmaker()
        async with Session() as session:
            row = (await session.execute(
                select(m.Company).where(
                    m.Company.user_id == get_settings().user_id,
                    m.Company.ticker == ticker.upper(),
                )
            )).scalar_one_or_none()
            if row is None:
                typer.echo(f"Unknown ticker '{ticker}'. Run `ao seed {ticker.lower()}` first.")
                return
            f = await poll_company(session, get_settings().user_id, row)
            if f is None:
                typer.echo("No new filings detected.")
            else:
                typer.echo(f"New filing: {f.form_type} {f.accession} ({f.reported_on})")
        await get_engine().dispose()

    asyncio.run(_go())


@app.command()
def discover(ticker: str) -> None:
    """Run the discovery stage — find CIK + IR URL + cadence for a ticker."""
    from ao.agents.discovery import discover_ticker
    from ao.db.engine import get_engine, get_sessionmaker

    async def _go() -> None:
        Session = get_sessionmaker()
        async with Session() as session:
            out = await discover_ticker(session, get_settings().user_id, ticker)
            if out is None:
                typer.echo("Discovery returned no result.")
                return
            typer.echo(f"name:    {out.name}")
            typer.echo(f"cik:     {out.cik}")
            typer.echo(f"ir_url:  {out.ir_url}")
            typer.echo(f"cadence: {out.cadence}")
        await get_engine().dispose()

    asyncio.run(_go())


if __name__ == "__main__":
    app()
