"""add_clerk_user_linking

Revision ID: 8c4d9f72e1ab
Revises: 5f9f8b6c1d2e
Create Date: 2026-03-28 17:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8c4d9f72e1ab"
down_revision: Union[str, None] = "5f9f8b6c1d2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("clerk_user_id", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_clerk_user_id", "users", ["clerk_user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_clerk_user_id", "users", type_="unique")
    op.drop_column("users", "clerk_user_id")
