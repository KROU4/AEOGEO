"""add_feedback_upsert_and_widget_events

Revision ID: c4d3f2a1b9e0
Revises: 8c4d9f72e1ab
Create Date: 2026-03-30 21:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d3f2a1b9e0"
down_revision: Union[str, None] = "8c4d9f72e1ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM feedback_entries AS older
        USING feedback_entries AS newer
        WHERE older.user_id = newer.user_id
          AND older.entity_type = newer.entity_type
          AND older.entity_id = newer.entity_id
          AND older.ctid < newer.ctid
        """
    )
    op.create_unique_constraint(
        "uq_feedback_entries_user_entity",
        "feedback_entries",
        ["user_id", "entity_type", "entity_id"],
    )

    op.create_table(
        "widget_events",
        sa.Column("widget_id", sa.Uuid(), nullable=False),
        sa.Column("content_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("session_id", sa.String(length=128), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["widget_id"], ["widgets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["content_id"], ["content.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_widget_events_widget_id", "widget_events", ["widget_id"])
    op.create_index("ix_widget_events_content_id", "widget_events", ["content_id"])


def downgrade() -> None:
    op.drop_index("ix_widget_events_content_id", table_name="widget_events")
    op.drop_index("ix_widget_events_widget_id", table_name="widget_events")
    op.drop_table("widget_events")
    op.drop_constraint(
        "uq_feedback_entries_user_entity",
        "feedback_entries",
        type_="unique",
    )
