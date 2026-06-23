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


@app.command()
def wipe() -> None:
    """Wipe fetched data and tracked companies. UI looks like a first-time
    visit; the user re-adds tickers from scratch.
    """
    from ao.db.wipe import wipe as _wipe
    asyncio.run(_wipe())


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


@app.command(name="force-run")
def force_run(ticker: str) -> None:
    """Re-run extraction → validation → narrative against the most recent filing
    for TICKER, bypassing the monitoring stage. Useful for retrying after a
    parser fix or prompt change without waiting for a new filing."""
    import asyncio as _asyncio
    from pathlib import Path
    from sqlalchemy import desc, select
    from ao.agents import extraction, narrative, validation
    from ao.db import models as m
    from ao.db.engine import get_engine, get_sessionmaker
    from ao.integrations import edgar_client
    from ao.notify import dispatcher
    from ao.notify.events import Event

    async def _go() -> None:
        user_id = get_settings().user_id
        Session = get_sessionmaker()
        async with Session() as session:
            c = (await session.execute(
                select(m.Company).where(
                    m.Company.user_id == user_id, m.Company.ticker == ticker.upper(),
                )
            )).scalar_one_or_none()
            if c is None:
                typer.echo(f"Unknown ticker '{ticker}'. Run `ao seed` first.")
                return
            f = (await session.execute(
                select(m.Filing).where(m.Filing.company_id == c.id)
                .order_by(desc(m.Filing.discovered_at)).limit(1)
            )).scalar_one_or_none()
            if f is None:
                typer.echo(f"No filings on file for {ticker.upper()}. Run `ao poll {ticker}` first.")
                return

            if not f.local_path or not Path(f.local_path).exists():
                typer.echo(f"Downloading {f.form_type} accession {f.accession}…")
                local = await edgar_client.download_filing(c.cik, f.accession or "", f.source_url or "")
                f.local_path = str(local)
                await session.commit()

            typer.echo(f"Extracting from {f.local_path}…")
            extracted = await extraction.extract_filing(
                session, user_id, company_id=c.id, ticker=ticker.upper(),
                pdf_path=Path(f.local_path),
            )
            typer.echo(f"  → {len(extracted)} metric locations")
            for e in extracted:
                tag = "✓" if e.verified else "?"
                typer.echo(f"    {tag} {e.key:18} {e.display_value:12} p.{e.page}")

            if not extracted:
                return

            typer.echo("Validating…")
            verdict = await validation.validate_metrics(
                session, user_id, company_id=c.id, ticker=ticker.upper(), extracted=extracted,
            )
            if verdict:
                typer.echo(
                    f"  → passed={verdict.passed} conflict={verdict.conflict} "
                    f"corrob={verdict.corroborations}"
                )

            typer.echo("Writing narrative…")
            current = {e.key: e.display_value for e in extracted}
            story = await narrative.write_narrative(
                session, user_id, company_id=c.id, ticker=ticker.upper(), current=current,
            )
            if story:
                typer.echo(f"  → {story}")

            # Persist Result + Metric + Provenance + fire event.
            from uuid import uuid4
            from datetime import datetime, timezone

            # Demote prior latest.
            prior_latest = (await session.execute(
                select(m.Result).where(m.Result.company_id == c.id, m.Result.is_latest == True)
            )).scalars().all()
            for r in prior_latest:
                r.is_latest = False

            now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
            result = m.Result(
                id=uuid4().hex, company_id=c.id, filing_id=f.id,
                period=f.period or f.form_type, period_end=f.period_end or "",
                reported_on=f.reported_on or now_iso,
                validated_on=now_iso if (verdict and verdict.passed) else None,
                validation_passed=bool(verdict and verdict.passed),
                validation_rule=verdict.rule if verdict else "",
                validation_detail=verdict.detail if verdict else "",
                validation_corroborations=verdict.corroborations if verdict else 0,
                validation_conflict=bool(verdict and verdict.conflict),
                validation_demo_synthetic=bool(verdict and getattr(verdict, "demo_synthetic", False)),
                narrative=story, is_latest=True,
            )
            session.add(result)

            by_key: dict[str, list] = {}
            for e in extracted:
                by_key.setdefault(e.key, []).append(e)
            confs: dict[str, str] = {}
            if verdict:
                for v in verdict.per_metric:
                    confs[v.key] = v.conf
            for key, locations in by_key.items():
                metric = m.Metric(
                    id=uuid4().hex, result_id=result.id, key=key,
                    display_value=locations[0].display_value,
                    raw_value=locations[0].raw_value,
                    yoy=None, conf=confs.get(key, "med"),
                )
                session.add(metric)
                for i, loc in enumerate(locations):
                    session.add(m.Provenance(
                        id=uuid4().hex, metric_id=metric.id, rank=i,
                        source_label=loc.source_label, url=f.source_url or "",
                        page=loc.page, quote=loc.quote,
                    ))
            # Flip the parent company status so the Watchlist card updates.
            if verdict and verdict.conflict:
                c.status = "review"
            elif verdict and verdict.passed:
                c.status = "validated"
            await session.commit()
            typer.echo(f"✓ Persisted Result + Metric + Provenance · company status → {c.status}")

            if verdict and verdict.passed:
                await dispatcher.dispatch(Event(
                    type="validated", ticker=ticker.upper(),
                    payload={"period": result.period,
                             "revenue": next((e.display_value for e in extracted if e.key=="Revenue"), "?"),
                             "eps_diluted": next((e.display_value for e in extracted if e.key=="EPS · diluted"), "?")},
                ))
                typer.echo("✓ Dispatched `validated` event (email + SMS)")
        await get_engine().dispose()

    _asyncio.run(_go())


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
