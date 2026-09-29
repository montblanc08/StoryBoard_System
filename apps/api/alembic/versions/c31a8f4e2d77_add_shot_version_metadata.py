"""add shot version parity metadata

Revision ID: c31a8f4e2d77
Revises: 9d4f6b12c8a1
Create Date: 2026-09-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c31a8f4e2d77"
down_revision: Union[str, Sequence[str], None] = "9d4f6b12c8a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("shot_versions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("name", sa.String(length=160), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("status", sa.String(length=64), nullable=False, server_default="Draft"))
        batch_op.add_column(sa.Column("branch_name", sa.String(length=64), nullable=False, server_default="main"))
        batch_op.add_column(sa.Column("parent_version_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("merge_parent_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("is_accepted", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.create_foreign_key(
            "fk_shot_versions_parent_version_id_shot_versions",
            "shot_versions",
            ["parent_version_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_shot_versions_merge_parent_id_shot_versions",
            "shot_versions",
            ["merge_parent_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_shot_versions_branch_name", ["branch_name"], unique=False)
        batch_op.create_index("ix_shot_versions_parent_version_id", ["parent_version_id"], unique=False)
        batch_op.create_index("ix_shot_versions_merge_parent_id", ["merge_parent_id"], unique=False)
        batch_op.create_index("ix_shot_versions_is_accepted", ["is_accepted"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("shot_versions", schema=None) as batch_op:
        batch_op.drop_index("ix_shot_versions_is_accepted")
        batch_op.drop_index("ix_shot_versions_merge_parent_id")
        batch_op.drop_index("ix_shot_versions_parent_version_id")
        batch_op.drop_index("ix_shot_versions_branch_name")
        batch_op.drop_constraint("fk_shot_versions_merge_parent_id_shot_versions", type_="foreignkey")
        batch_op.drop_constraint("fk_shot_versions_parent_version_id_shot_versions", type_="foreignkey")
        batch_op.drop_column("is_accepted")
        batch_op.drop_column("merge_parent_id")
        batch_op.drop_column("parent_version_id")
        batch_op.drop_column("branch_name")
        batch_op.drop_column("status")
        batch_op.drop_column("name")
