"""task → model resolution. Reads the routing_rules table (per-user)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.config import get_settings
from ao.db import models as m

# Database task names ↔ internal stage keys. The DB stores human task labels
# (matching what the UI segmented controls show); the internal code uses these
# compact stage keys.
TASK_NAMES = {
    "discovery": "Source discovery",
    "monitor": "Monitoring poll",
    "extraction": "Extraction",
    "validation": "Validation",
    # narrative isn't a separate routing row in v1 — reuses validation's model.
    "narrative": "Validation",
    # help isn't user-configurable: the assistant is grounded by the corpus and
    # the cheap fast model is the right call. Pinned via settings, no DB row.
    "help": "Help",
}

# Map of stored "Claude Opus 4" / "Claude Sonnet 4" / "Claude Haiku 4"
# display names → real Anthropic model IDs.
DISPLAY_TO_ID = {
    "Claude Opus 4": None,   # populated from settings.default_model_extraction
    "Claude Sonnet 4": None,
    "Claude Haiku 4": None,
}


def _populate_display_map() -> None:
    s = get_settings()
    DISPLAY_TO_ID["Claude Opus 4"] = s.default_model_extraction
    DISPLAY_TO_ID["Claude Sonnet 4"] = s.default_model_discovery
    DISPLAY_TO_ID["Claude Haiku 4"] = s.default_model_monitor


async def model_for(session: AsyncSession, user_id: str, stage: str) -> str:
    """Return the Anthropic model ID configured for `stage` and this user."""
    _populate_display_map()
    task_name = TASK_NAMES.get(stage, stage)
    row = (await session.execute(
        select(m.RoutingRule).where(
            m.RoutingRule.user_id == user_id, m.RoutingRule.task == task_name,
        )
    )).scalar_one_or_none()
    if row is None:
        # Fallbacks per stage.
        s = get_settings()
        return {
            "discovery": s.default_model_discovery,
            "monitor": s.default_model_monitor,
            "extraction": s.default_model_extraction,
            "validation": s.default_model_validation,
            "narrative": s.default_model_narrative,
            "help": s.default_model_help,
        }.get(stage, s.default_model_extraction)
    return DISPLAY_TO_ID.get(row.model, row.model)
