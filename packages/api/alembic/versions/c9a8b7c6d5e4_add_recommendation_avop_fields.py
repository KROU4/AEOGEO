"""add recommendation status, instructions, impact, source, sort_rank, scope

Revision ID: c9a8b7c6d5e4
Revises: b3c4d5e6f7a8
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9a8b7c6d5e4"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recommendations",
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "recommendations",
        sa.Column("impact_estimate", sa.Text(), nullable=True),
    )
    op.add_column(
        "recommendations",
        sa.Column("instructions", sa.Text(), nullable=True),
    )
    op.add_column(
        "recommendations",
        sa.Column("source", sa.String(256), nullable=True),
    )
    op.add_column(
        "recommendations",
        sa.Column("sort_rank", sa.Integer(), nullable=True),
    )
    op.add_column(
        "recommendations",
        sa.Column("scope", sa.String(16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recommendations", "scope")
    op.drop_column("recommendations", "sort_rank")
    op.drop_column("recommendations", "source")
    op.drop_column("recommendations", "instructions")
    op.drop_column("recommendations", "impact_estimate")
    op.drop_column("recommendations", "status")
