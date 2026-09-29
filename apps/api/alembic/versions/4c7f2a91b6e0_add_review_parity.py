"""add review parity fields and decisions

Revision ID: 4c7f2a91b6e0
Revises: fdc1353e5b23
Create Date: 2026-09-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4c7f2a91b6e0"
down_revision: Union[str, Sequence[str], None] = "fdc1353e5b23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Preserve the review metadata already present in the 5e86 functional
    # baseline while keeping the VNext Comment model canonical.
    with op.batch_alter_table("comments", schema=None) as batch_op:
        batch_op.add_column(sa.Column("timecode", sa.String(length=32), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("quote_field", sa.String(length=128), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("quote_text", sa.Text(), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("parent_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.create_foreign_key(
            "fk_comments_parent_id_comments",
            "comments",
            ["parent_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_comments_parent_id", ["parent_id"], unique=False)
        batch_op.create_index("ix_comments_is_resolved", ["is_resolved"], unique=False)

    op.create_table(
        "review_decisions",
        sa.Column("shot_id", sa.String(), nullable=False),
        sa.Column("version_id", sa.String(), nullable=True),
        sa.Column("previous_status", sa.String(length=64), nullable=False),
        sa.Column("next_status", sa.String(length=64), nullable=False),
        sa.Column("action_label", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["shot_id"],
            ["shots.id"],
            name="fk_review_decisions_shot_id_shots",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["version_id"],
            ["shot_versions.id"],
            name="fk_review_decisions_version_id_shot_versions",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_review_decisions"),
    )
    with op.batch_alter_table("review_decisions", schema=None) as batch_op:
        batch_op.create_index("ix_review_decisions_shot_id", ["shot_id"], unique=False)
        batch_op.create_index("ix_review_decisions_version_id", ["version_id"], unique=False)
        batch_op.create_index("ix_review_decisions_created_by", ["created_by"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("review_decisions", schema=None) as batch_op:
        batch_op.drop_index("ix_review_decisions_created_by")
        batch_op.drop_index("ix_review_decisions_version_id")
        batch_op.drop_index("ix_review_decisions_shot_id")
    op.drop_table("review_decisions")

    with op.batch_alter_table("comments", schema=None) as batch_op:
        batch_op.drop_index("ix_comments_is_resolved")
        batch_op.drop_index("ix_comments_parent_id")
        batch_op.drop_constraint("fk_comments_parent_id_comments", type_="foreignkey")
        batch_op.drop_column("is_resolved")
        batch_op.drop_column("parent_id")
        batch_op.drop_column("quote_text")
        batch_op.drop_column("quote_field")
        batch_op.drop_column("timecode")
