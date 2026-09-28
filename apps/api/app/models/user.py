"""User and Role SQLAlchemy 2 Models."""
from __future__ import annotations

from typing import Optional
from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    permissions: Mapped[dict] = mapped_column(JSON, default=dict)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(128), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[Optional[str]] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    role: Mapped[Optional[Role]] = relationship(back_populates="users", lazy="selectin")
