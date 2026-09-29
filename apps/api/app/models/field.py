"""Custom field values and project column lifecycle models."""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CustomFieldDefinition(Base):
    __tablename__ = "custom_field_definitions"
    __table_args__ = (
        UniqueConstraint(
            "production_id",
            "key",
            name="uq_custom_field_definitions_production_key",
        ),
    )

    production_id: Mapped[str] = mapped_column(
        ForeignKey("productions.id", ondelete="CASCADE"),
        index=True,
    )
    key: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    field_type: Mapped[str] = mapped_column(String(32), default="text", index=True)
    group_name: Mapped[str] = mapped_column(String(80), default="Custom")
    options: Mapped[list] = mapped_column(JSON, default=list)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    default_value: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    sort_index: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # A purged definition remains as an immutable key tombstone so stale
    # clients, Saved Views and import mappings cannot recreate the same column.
    is_purged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class ShotCustomFieldValue(Base):
    __tablename__ = "shot_custom_field_values"
    __table_args__ = (
        UniqueConstraint(
            "shot_id",
            "field_definition_id",
            name="uq_shot_custom_field_values_shot_field",
        ),
    )

    shot_id: Mapped[str] = mapped_column(
        ForeignKey("shots.id", ondelete="CASCADE"),
        index=True,
    )
    field_definition_id: Mapped[str] = mapped_column(
        ForeignKey("custom_field_definitions.id", ondelete="CASCADE"),
        index=True,
    )
    value: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class ColumnPreference(Base):
    __tablename__ = "column_preferences"
    __table_args__ = (
        UniqueConstraint(
            "production_id",
            "column_key",
            name="uq_column_preferences_production_key",
        ),
    )

    production_id: Mapped[str] = mapped_column(
        ForeignKey("productions.id", ondelete="CASCADE"),
        index=True,
    )
    column_key: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(16), default="visible", index=True)
    permanently_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    width_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    wrap_text: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
