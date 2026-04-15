"""add tenant.plan

Revision ID: d0e1f2a3b4c5
Revises: c9a8b7c6d5e4
Create Date: 2026-04-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d0e1f2a3b4c5"
down_revision: str | None = "c9a8b7c6d5e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("plan", sa.String(length=32), server_default="free", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("tenants", "plan")
