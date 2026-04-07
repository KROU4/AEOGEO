"""add_widget_active_and_jsonld_columns

Revision ID: 3f8b2c9d4e1a
Revises: 02a5580e508f
Create Date: 2026-03-27 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f8b2c9d4e1a'
down_revision: Union[str, None] = '02a5580e508f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('widgets', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('widgets', sa.Column('json_ld_enabled', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('widgets', 'json_ld_enabled')
    op.drop_column('widgets', 'is_active')
