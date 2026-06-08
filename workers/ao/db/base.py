"""SQLAlchemy 2.x declarative base.

All models inherit from `Base`. Kept separate from engine.py so models can
import the base without dragging in async-engine imports.
"""
from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Project base. Subclass for every table."""
    pass
