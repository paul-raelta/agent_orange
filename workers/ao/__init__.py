"""Agent Orange — agentic backend for financial-results monitoring.

The whole package is one process: API + scheduler + agent pipeline. The dev
runtime can split them (uvicorn for API, `python -m ao.daemon` for scheduler)
or fuse them via AO_RUN_SCHEDULER_IN_PROCESS=1 — same code path either way.
"""

__version__ = "0.1.0"
