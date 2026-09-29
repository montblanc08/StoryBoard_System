"""add saved views

Revision ID: 7ab3c5e91f20
Revises: 2f8d91c4a6b3
Create Date: 2026-09-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7ab3c5e91f20"
down_revision: Union[str, Sequence[str], None] = "2f8d91c4a6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_views",
        sa.Column("production_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("view_type", sa.String(length=32), nullable=False, server_default="table"),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["production_id"],
            ["productions.id"],
            name="fk_saved_views_production_id_productions",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_saved_views"),
    )
    op.create_index("ix_saved_views_production_id", "saved_views", ["production_id"], unique=False)
    op.create_index("ix_saved_views_view_type", "saved_views", ["view_type"], unique=False)
    op.create_index("ix_saved_views_created_by", "saved_views", ["created_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_views_created_by", table_name="saved_views")
    op.drop_index("ix_saved_views_view_type", table_name="saved_views")
    op.drop_index("ix_saved_views_production_id", table_name="saved_views")
    op.drop_table("saved_views")
