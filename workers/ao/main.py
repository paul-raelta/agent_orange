"""FastAPI app factory and entrypoint.

`ao-api` runs `uvicorn ao.main:app`; that's the only "production" path. Locally
the Makefile bridges via `uvicorn --reload`.

If AO_RUN_SCHEDULER_IN_PROCESS=1 (default 0), the API process also starts the
APScheduler — handy for tiny one-process dev. Otherwise the scheduler is its
own process (`python -m ao.daemon`). Under uvicorn --reload, keep it OFF: hot
reload double-spawns jobs.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ao.config import ensure_var_dirs, get_settings
from ao.logging import get_logger, setup_logging

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    setup_logging(settings.log_level)
    ensure_var_dirs()
    log.info("api.startup", port=settings.api_port, db=settings.database_url)
    # API routers will be mounted in create_app(); DB engine init happens lazily
    # on first query via ao.db.engine.get_session().
    if settings.run_scheduler_in_process and settings.scheduler_mode == "inproc":
        log.info("scheduler.starting_in_api_process")
        # Avoided circular: imported here, not at module top.
        from ao.scheduler.scheduler import start_scheduler

        await start_scheduler()
    yield
    log.info("api.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Agent Orange API", version="0.1.0", lifespan=lifespan)

    # allow_origins=['*'] requires allow_credentials=False per the CORS spec.
    # We don't ship cookies in v1 (no auth flow) so that's fine.
    using_wildcard = "*" in settings.cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=not using_wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers are mounted here. Import-time side effects in routers are fine
    # (FastAPI router objects don't open DB connections).
    from ao.api import (
        routes_activity,
        routes_admin,
        routes_companies,
        routes_events,
        routes_health,
        routes_news,
        routes_portfolio,
        routes_providers,
        routes_review,
        routes_run,
        routes_settings,
        routes_sources,
        routes_usage,
    )

    prefix = "/api/v1"
    app.include_router(routes_health.router)  # no prefix — keep /healthz top-level
    app.include_router(routes_companies.router, prefix=prefix)
    app.include_router(routes_review.router, prefix=prefix)
    app.include_router(routes_activity.router, prefix=prefix)
    app.include_router(routes_usage.router, prefix=prefix)
    app.include_router(routes_providers.router, prefix=prefix)
    app.include_router(routes_run.router, prefix=prefix)
    app.include_router(routes_settings.router, prefix=prefix)
    app.include_router(routes_sources.router, prefix=prefix)
    app.include_router(routes_news.router, prefix=prefix)
    app.include_router(routes_portfolio.router, prefix=prefix)
    app.include_router(routes_events.router, prefix=prefix)
    app.include_router(routes_admin.router, prefix=prefix)

    return app


app = create_app()


def run_api() -> None:
    """Console-script entry: `ao-api`. Bind to 0.0.0.0 so LAN access works
    (your phone / iPad / another laptop hitting your Mac's IP). Lock down by
    setting AO_API_HOST if you want strictly local-only."""
    settings = get_settings()
    import os
    uvicorn.run(
        "ao.main:app",
        host=os.getenv("AO_API_HOST", "0.0.0.0"),
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
