"""add review comment role

Revision ID: 9d4f6b12c8a1
Revises: 4c7f2a91b6e0
Create Date: 2026-09-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d4f6b12c8a1"
down_revision: Union[str, Sequence[str], None] = "4c7f2a91b6e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("comments", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("role", sa.String(length=64), nullable=False, server_default="Director")
        )


def downgrade() -> None:
    with op.batch_alter_table("comments", schema=None) as batch_op:
        batch_op.drop_column("role")
