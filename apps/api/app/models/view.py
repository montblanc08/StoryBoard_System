"""Saved table/storyboard view models."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SavedView(Base):
    __tablename__ = "saved_views"

    production_id: Mapped[str] = mapped_column(
        ForeignKey("productions.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(80))
    view_type: Mapped[str] = mapped_column(String(32), default="table", index=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    revision: Mapped[int] = mapped_column(Integer, default=1)
