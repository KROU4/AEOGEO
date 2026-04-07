"""add_user_invite_and_reset_columns

Revision ID: a1b2c3d4e5f6
Revises: 3f8b2c9d4e1a
Create Date: 2026-03-27 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3f8b2c9d4e1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('invite_token', sa.String(length=512), nullable=True))
    op.add_column('users', sa.Column('invite_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('reset_token', sa.String(length=512), nullable=True))
    op.add_column('users', sa.Column('reset_expires_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'reset_expires_at')
    op.drop_column('users', 'reset_token')
    op.drop_column('users', 'invite_expires_at')
    op.drop_column('users', 'invite_token')
