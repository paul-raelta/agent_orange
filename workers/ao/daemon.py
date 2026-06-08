"""APScheduler daemon entrypoint.

Run with `python -m ao.daemon` or via `ao-daemon` console script. Keeps the
scheduler in its own process so uvicorn's --reload doesn't double-spawn jobs.

Cloud Run later: this process becomes a Cloud Run Job triggered by Cloud
Scheduler. The scheduler/jobs.py functions are the same; only the trigger
source changes (`AO_SCHEDULER_MODE=external` disables this loop and exposes
HTTP-triggered job endpoints instead).
"""
from __future__ import annotations

import asyncio

from ao.config import ensure_var_dirs, get_settings
from ao.logging import get_logger, setup_logging

log = get_logger(__name__)


async def _main() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    ensure_var_dirs()
    log.info("daemon.startup", mode=settings.scheduler_mode)

    if settings.scheduler_mode != "inproc":
        log.warning("daemon.scheduler_mode_external_nothing_to_do")
        return

    from ao.scheduler.scheduler import start_scheduler

    await start_scheduler()
    # Block forever — let APScheduler do its thing.
    stop = asyncio.Event()
    try:
        await stop.wait()
    except (asyncio.CancelledError, KeyboardInterrupt):
        log.info("daemon.shutdown")


def run_daemon() -> None:
    """Console-script entry: `ao-daemon`."""
    asyncio.run(_main())


if __name__ == "__main__":
    run_daemon()
