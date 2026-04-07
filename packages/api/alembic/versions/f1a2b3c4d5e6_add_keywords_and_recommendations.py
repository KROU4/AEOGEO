"""add_keywords_and_recommendations

Revision ID: f1a2b3c4d5e6
Revises: d5e6f7a8b9c0
Create Date: 2026-04-06 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "keywords",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("keyword", sa.String(512), nullable=False),
        sa.Column("category", sa.String(128), nullable=False, server_default="general"),
        sa.Column("search_volume", sa.Integer, nullable=True),
        sa.Column("relevance_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("is_selected", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_keywords_project_category",
        "keywords",
        ["project_id", "category"],
    )

    op.create_table(
        "recommendations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("affected_keywords", sa.JSON, nullable=True),
        sa.Column(
            "run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("engine_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_recommendations_project_created",
        "recommendations",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_recommendations_project_created", table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_index("ix_keywords_project_category", table_name="keywords")
    op.drop_table("keywords")
