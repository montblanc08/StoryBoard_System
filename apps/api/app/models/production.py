"""Production, Sequence and Scene SQLAlchemy 2 Models."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Production(Base):
    __tablename__ = "productions"

    name: Mapped[str] = mapped_column(String(255), index=True)
    code: Mapped[str] = mapped_column(String(64), default="")
    template_type: Mapped[str] = mapped_column(String(64), default="corporate")
    fps_num: Mapped[int] = mapped_column(Integer, default=25)
    fps_den: Mapped[int] = mapped_column(Integer, default=1)
    drop_frame: Mapped[bool] = mapped_column(Boolean, default=False)
    start_timecode_frames: Mapped[int] = mapped_column(BigInteger, default=90000)  # 01:00:00:00 @ 25fps
    target_duration_frames: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    aspect_ratio: Mapped[str] = mapped_column(String(32), default="16:9")
    width: Mapped[int] = mapped_column(Integer, default=1920)
    height: Mapped[int] = mapped_column(Integer, default=1080)
    status: Mapped[str] = mapped_column(String(64), default="development")
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, index=True)

    sequences: Mapped[list["Sequence"]] = relationship(back_populates="production", cascade="all, delete-orphan")
    shots: Mapped[list["Shot"]] = relationship(back_populates="production", cascade="all, delete-orphan")


class Sequence(Base):
    __tablename__ = "sequences"

    production_id: Mapped[str] = mapped_column(ForeignKey("productions.id", ondelete="CASCADE"), index=True)
    display_number: Mapped[str] = mapped_column(String(64), default="SEQ010")
    name: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    sort_index: Mapped[float] = mapped_column(Float, default=1000.0, index=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, index=True)

    production: Mapped[Production] = relationship(back_populates="sequences")
    scenes: Mapped[list["Scene"]] = relationship(back_populates="sequence", cascade="all, delete-orphan")


class Scene(Base):
    __tablename__ = "scenes"

    production_id: Mapped[str] = mapped_column(ForeignKey("productions.id", ondelete="CASCADE"), index=True)
    sequence_id: Mapped[str] = mapped_column(ForeignKey("sequences.id", ondelete="CASCADE"), index=True)
    display_number: Mapped[str] = mapped_column(String(64), default="010A")
    name: Mapped[str] = mapped_column(String(255), default="")
    int_ext: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    day_night: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    sort_index: Mapped[float] = mapped_column(Float, default=1000.0, index=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, index=True)

    sequence: Mapped[Sequence] = relationship(back_populates="scenes")
