"""add_products_table

Revision ID: 221737a06382
Revises: a1b2c3d4e5f6
Create Date: 2026-03-28 08:37:25.332434

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '221737a06382'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'products',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('features', sa.JSON, nullable=True),
        sa.Column('pricing', sa.String(256), nullable=True),
        sa.Column('category', sa.String(128), nullable=True),
        sa.Column('brand_id', UUID(as_uuid=True), sa.ForeignKey('brands.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table('products')
