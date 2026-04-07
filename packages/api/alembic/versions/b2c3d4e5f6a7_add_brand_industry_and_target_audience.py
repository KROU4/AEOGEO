"""add_brand_industry_and_target_audience

Revision ID: b2c3d4e5f6a7
Revises: a7b8c9d0e1f2
Create Date: 2026-04-07 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "brands",
        sa.Column("industry", sa.String(length=256), nullable=True),
    )
    op.add_column(
        "brands",
        sa.Column("target_audience", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("brands", "target_audience")
    op.drop_column("brands", "industry")
