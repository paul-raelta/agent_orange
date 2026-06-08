"""structlog setup. Console-friendly in dev, JSON in production.

Format is chosen off AO_LOG_LEVEL + the AO_LOG_JSON env var (off by default).
Every API request gets a request_id via middleware; every agent run gets a
run_id; both flow into the log record so traces are reconstructable from logs.
"""
from __future__ import annotations

import logging
import os
import sys

import structlog


def setup_logging(level: str = "INFO") -> None:
    use_json = os.getenv("AO_LOG_JSON", "0") == "1"

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper(), logging.INFO),
    )

    shared = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if use_json:
        processors = [*shared, structlog.processors.JSONRenderer()]
    else:
        processors = [*shared, structlog.dev.ConsoleRenderer(colors=True)]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
