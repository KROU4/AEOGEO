"""add public_audits table

Revision ID: b3c4d5e6f7a8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "public_audits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("geo_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("linked_user_id", sa.Uuid(), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["linked_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_public_audits_email", "public_audits", ["email"], unique=False)
    op.create_index(
        "ix_public_audits_linked_user_id",
        "public_audits",
        ["linked_user_id"],
        unique=False,
    )
    op.create_index("ix_public_audits_ip_hash", "public_audits", ["ip_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_public_audits_ip_hash", table_name="public_audits")
    op.drop_index("ix_public_audits_linked_user_id", table_name="public_audits")
    op.drop_index("ix_public_audits_email", table_name="public_audits")
    op.drop_table("public_audits")
