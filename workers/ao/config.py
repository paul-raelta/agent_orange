"""Single source of truth for runtime configuration.

Reads env vars + workers/.env via pydantic-settings. Cloud Run later swaps the
.env file for Secret Manager bindings — no code changes downstream.

Cost rates per model are kept here (not in DB) so a new Anthropic price card is
a one-line edit. Token accounting in `integrations/anthropic_client.py` reads
these to compute per-call USD cost.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo paths — everything else hangs off WORKERS_ROOT so the daemon doesn't
# care which directory it was launched from.
WORKERS_ROOT = Path(__file__).resolve().parent.parent  # workers/
REPO_ROOT = WORKERS_ROOT.parent
VAR_DIR = WORKERS_ROOT / "var"
CACHE_DIR = VAR_DIR / "cache"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(WORKERS_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    api_port: int = Field(8000, alias="API_PORT")
    log_level: str = Field("INFO", alias="AO_LOG_LEVEL")
    # Wide open during local dev so the UI works from any LAN device
    # (phone, tablet, second laptop). Tightened to your real origin list when
    # the app moves behind a domain.
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    # --- Database ---
    # Stored in workers/var/ao.db locally. Postgres URL swaps in for cloud.
    database_url: str = Field(
        f"sqlite+aiosqlite:///{VAR_DIR / 'ao.db'}", alias="DATABASE_URL"
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def _coerce_async_driver(cls, v: str) -> str:
        # Railway/Heroku inject DATABASE_URL with the libpq scheme. SQLAlchemy
        # async needs an explicit async driver — swap it in transparently so
        # the platform-provided value Just Works.
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = "postgresql+asyncpg://" + v[len("postgres://"):]
            elif v.startswith("postgresql://") and "+" not in v.split("://", 1)[0]:
                v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    # --- Scheduler ---
    # inproc = APScheduler runs locally (this process or the ao-daemon process)
    # external = scheduler disabled; Cloud Scheduler will hit /internal/jobs/*
    scheduler_mode: str = Field("inproc", alias="AO_SCHEDULER_MODE")
    run_scheduler_in_process: bool = Field(False, alias="AO_RUN_SCHEDULER_IN_PROCESS")

    # --- LLM (Anthropic) ---
    anthropic_api_key: str = Field("", alias="ANTHROPIC_API_KEY")
    # Default model per stage. Routed at runtime via the routing_rules table.
    # These are the "first time" seed values for a new user.
    default_model_discovery: str = "claude-sonnet-4-5"
    default_model_monitor: str = "claude-haiku-4-5-20251001"
    default_model_extraction: str = "claude-opus-4-7"
    default_model_validation: str = "claude-opus-4-7"
    default_model_narrative: str = "claude-opus-4-7"
    # Help Assistant — Q&A about the app itself. Cheap & fast; the KB already
    # grounds it, so Haiku is plenty.
    default_model_help: str = "claude-haiku-4-5-20251001"

    # --- Finnhub ---
    finnhub_api_key: str = Field("", alias="FINNHUB_API_KEY")

    # --- Email (Gmail SMTP) ---
    gmail_user: str = Field("", alias="GMAIL_USER")
    gmail_app_password: str = Field("", alias="GMAIL_APP_PASSWORD")

    # --- SMS (Twilio) ---
    twilio_account_sid: str = Field("", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field("", alias="TWILIO_AUTH_TOKEN")
    twilio_from: str = Field("", alias="TWILIO_FROM")

    # --- Single hardcoded user (until auth lands) ---
    user_email: str = Field("paulmcevoy@gmail.com", alias="USER_EMAIL")
    user_phone: str = Field("", alias="USER_PHONE")
    # The user_id every row is keyed by. Stable across restarts.
    user_id: str = "u_local"

    # --- App URL (used in outbound notifications so the link is clickable) ---
    app_url: str = Field(
        "https://agentorange-production.up.railway.app/", alias="APP_URL"
    )

    # --- EDGAR ---
    # Required by SEC: declare a real contact in the User-Agent.
    @property
    def edgar_user_agent(self) -> str:
        return f"Agent Orange ({self.user_email})"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


# --- Anthropic cost table (USD per 1M tokens) -----------------------------------
# Source: Anthropic public pricing as of 2026-06. Update when the price card moves.
# Used by integrations/anthropic_client.py to compute per-call cost_usd.
MODEL_PRICING: dict[str, tuple[float, float]] = {
    # (input_per_mtok, output_per_mtok)
    "claude-opus-4-7": (15.0, 75.0),
    "claude-opus-4-6": (15.0, 75.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
}


def cost_for(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute USD cost for a single Anthropic call."""
    rates = MODEL_PRICING.get(model, (3.0, 15.0))  # default to Sonnet rates
    return (input_tokens / 1_000_000) * rates[0] + (output_tokens / 1_000_000) * rates[1]


def ensure_var_dirs() -> None:
    """Create runtime dirs if missing. Safe to call at every startup."""
    VAR_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
