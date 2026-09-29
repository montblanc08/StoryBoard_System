"""enforce unique version number per shot

Revision ID: 2f8d91c4a6b3
Revises: c31a8f4e2d77
Create Date: 2026-09-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "2f8d91c4a6b3"
down_revision: Union[str, Sequence[str], None] = "c31a8f4e2d77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("shot_versions", schema=None) as batch_op:
        batch_op.create_unique_constraint(
            "uq_shot_versions_shot_version_number",
            ["shot_id", "version_number"],
        )


def downgrade() -> None:
    with op.batch_alter_table("shot_versions", schema=None) as batch_op:
        batch_op.drop_constraint(
            "uq_shot_versions_shot_version_number",
            type_="unique",
        )
