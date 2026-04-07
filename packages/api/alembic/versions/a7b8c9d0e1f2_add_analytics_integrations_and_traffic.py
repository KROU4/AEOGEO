"""add_analytics_integrations_and_traffic_snapshots

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-04-07 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analytics_integrations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("encrypted_credentials", sa.String(8192), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("last_synced_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_analytics_integrations_project",
        "analytics_integrations",
        ["project_id"],
    )

    op.create_table(
        "traffic_snapshots",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("pageviews", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("sessions", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("users", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("traffic_sources", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint(
            "project_id", "provider", "date",
            name="uq_traffic_project_provider_date",
        ),
    )
    op.create_index(
        "ix_traffic_snapshots_project_date",
        "traffic_snapshots",
        ["project_id", "date"],
    )


def downgrade() -> None:
    op.drop_index("ix_traffic_snapshots_project_date", table_name="traffic_snapshots")
    op.drop_table("traffic_snapshots")
    op.drop_index("ix_analytics_integrations_project", table_name="analytics_integrations")
    op.drop_table("analytics_integrations")
