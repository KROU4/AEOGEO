"""add_project_content_locale

Revision ID: d5e6f7a8b9c0
Revises: c4d3f2a1b9e0
Create Date: 2026-04-01 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d3f2a1b9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("content_locale", sa.String(length=8), server_default="en", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("projects", "content_locale")
