"""add site_audits.started_at

Revision ID: g1a2b3c4d5e6
Revises: f2a3b4c5d6e7
Create Date: 2026-04-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "g1a2b3c4d5e6"
down_revision: str | None = "f2a3b4c5d6e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "site_audits",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text("UPDATE site_audits SET started_at = created_at WHERE started_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_column("site_audits", "started_at")
