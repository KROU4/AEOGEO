"""add content_push_events table

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: str | None = "e1f2a3b4c5d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "content_push_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("triggered_by_user_id", sa.UUID(), nullable=True),
        sa.Column("content_title", sa.String(length=512), nullable=True),
        sa.Column("content_url", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("recheck_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column(
            "baseline_total_score",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("baseline_mentions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("baseline_citations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checked_total_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("checked_mentions", sa.Integer(), nullable=True),
        sa.Column("checked_citations", sa.Integer(), nullable=True),
        sa.Column("delta_total_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("delta_mentions", sa.Integer(), nullable=True),
        sa.Column("delta_citations", sa.Integer(), nullable=True),
        sa.Column("temporal_workflow_id", sa.String(length=256), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["triggered_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_content_push_events_project_id"),
        "content_push_events",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_content_push_events_project_id"), table_name="content_push_events")
    op.drop_table("content_push_events")
