"""harden_pipeline_state_and_answer_scores

Revision ID: 5f9f8b6c1d2e
Revises: 221737a06382
Create Date: 2026-03-28 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "5f9f8b6c1d2e"
down_revision: Union[str, None] = "221737a06382"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "engine_runs",
        sa.Column("engine_status", sa.String(length=32), server_default="pending", nullable=False),
    )
    op.add_column(
        "engine_runs",
        sa.Column("parse_status", sa.String(length=32), server_default="pending", nullable=False),
    )
    op.add_column(
        "engine_runs",
        sa.Column("score_status", sa.String(length=32), server_default="pending", nullable=False),
    )
    op.add_column("engine_runs", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column(
        "engine_runs",
        sa.Column("answers_expected", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "engine_runs",
        sa.Column("answers_completed", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "engine_runs",
        sa.Column("parse_completed", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "engine_runs",
        sa.Column("score_completed", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("engine_runs", sa.Column("engine_started_at", sa.DateTime(), nullable=True))
    op.add_column("engine_runs", sa.Column("engine_completed_at", sa.DateTime(), nullable=True))
    op.add_column("engine_runs", sa.Column("parse_started_at", sa.DateTime(), nullable=True))
    op.add_column("engine_runs", sa.Column("parse_completed_at", sa.DateTime(), nullable=True))
    op.add_column("engine_runs", sa.Column("score_started_at", sa.DateTime(), nullable=True))
    op.add_column("engine_runs", sa.Column("score_completed_at", sa.DateTime(), nullable=True))

    op.add_column(
        "answers",
        sa.Column("query_text", sa.Text(), server_default="", nullable=False),
    )
    op.add_column(
        "answers",
        sa.Column("engine_name", sa.String(length=128), server_default="", nullable=False),
    )
    op.add_column(
        "answers",
        sa.Column("engine_provider", sa.String(length=128), server_default="", nullable=False),
    )
    op.add_column(
        "answers",
        sa.Column("parse_status", sa.String(length=32), server_default="pending", nullable=False),
    )
    op.add_column("answers", sa.Column("parse_error", sa.Text(), nullable=True))
    op.add_column("answers", sa.Column("parse_fingerprint", sa.String(length=64), nullable=True))
    op.add_column("answers", sa.Column("parsed_at", sa.DateTime(), nullable=True))
    op.add_column(
        "answers",
        sa.Column("score_status", sa.String(length=32), server_default="pending", nullable=False),
    )
    op.add_column("answers", sa.Column("score_error", sa.Text(), nullable=True))
    op.add_column("answers", sa.Column("scored_at", sa.DateTime(), nullable=True))

    op.add_column(
        "visibility_scores",
        sa.Column("answer_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_visibility_scores_answer_id_answers",
        "visibility_scores",
        "answers",
        ["answer_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.execute(
        """
        UPDATE answers AS a
        SET query_text = COALESCE(q.text, ''),
            engine_name = COALESCE(e.name, ''),
            engine_provider = COALESCE(e.provider, '')
        FROM queries AS q, engines AS e
        WHERE a.query_id = q.id
          AND a.engine_id = e.id
        """
    )

    op.execute(
        """
        UPDATE visibility_scores AS vs
        SET answer_id = (
            SELECT a.id AS answer_id
            FROM answers AS a
            WHERE a.run_id = vs.run_id
              AND a.query_id = vs.query_id
              AND a.engine_id = vs.engine_id
            ORDER BY a.sample_index ASC, a.created_at ASC, a.id ASC
            LIMIT 1
        )
        WHERE vs.answer_id IS NULL
        """
    )
    op.execute(
        """
        DELETE FROM visibility_scores AS dupe
        USING visibility_scores AS keep
        WHERE dupe.answer_id IS NOT NULL
          AND dupe.answer_id = keep.answer_id
          AND dupe.ctid < keep.ctid
        """
    )
    op.execute("DELETE FROM visibility_scores WHERE answer_id IS NULL")

    op.execute(
        """
        UPDATE answers AS a
        SET parse_status = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM mentions AS m
                    WHERE m.answer_id = a.id
                ) OR EXISTS (
                    SELECT 1
                    FROM citations AS c
                    WHERE c.answer_id = a.id
                ) OR EXISTS (
                    SELECT 1
                    FROM visibility_scores AS vs
                    WHERE vs.answer_id = a.id
                ) THEN 'completed'
                ELSE 'pending'
            END,
            parsed_at = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM mentions AS m
                    WHERE m.answer_id = a.id
                ) OR EXISTS (
                    SELECT 1
                    FROM citations AS c
                    WHERE c.answer_id = a.id
                ) OR EXISTS (
                    SELECT 1
                    FROM visibility_scores AS vs
                    WHERE vs.answer_id = a.id
                ) THEN a.updated_at
                ELSE NULL
            END,
            score_status = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM visibility_scores AS vs
                    WHERE vs.answer_id = a.id
                ) THEN 'completed'
                ELSE 'pending'
            END,
            scored_at = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM visibility_scores AS vs
                    WHERE vs.answer_id = a.id
                ) THEN a.updated_at
                ELSE NULL
            END
        """
    )

    op.execute(
        """
        UPDATE engine_runs AS r
        SET answers_expected = (
                SELECT COUNT(*)
                FROM queries AS q
                WHERE q.query_set_id = r.query_set_id
                  AND q.status = 'approved'
            ) * r.sample_count,
            answers_completed = (
                SELECT COUNT(*)
                FROM answers AS a
                WHERE a.run_id = r.id
            ),
            parse_completed = (
                SELECT COUNT(*)
                FROM answers AS a
                WHERE a.run_id = r.id
                  AND a.parse_status = 'completed'
            ),
            score_completed = (
                SELECT COUNT(*)
                FROM answers AS a
                WHERE a.run_id = r.id
                  AND a.score_status = 'completed'
            ),
            engine_status = CASE
                WHEN r.status IN ('completed', 'partial') THEN 'completed'
                WHEN r.status = 'failed' THEN 'failed'
                ELSE r.status
            END,
            parse_status = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM answers AS a
                    WHERE a.run_id = r.id
                      AND a.parse_status = 'completed'
                ) THEN 'completed'
                WHEN r.status = 'failed' THEN 'pending'
                ELSE 'pending'
            END,
            score_status = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM answers AS a
                    WHERE a.run_id = r.id
                      AND a.score_status = 'completed'
                ) THEN 'completed'
                WHEN r.status = 'failed' THEN 'pending'
                ELSE 'pending'
            END,
            engine_started_at = r.started_at,
            engine_completed_at = CASE
                WHEN r.status IN ('completed', 'partial', 'failed') THEN r.completed_at
                ELSE NULL
            END,
            parse_started_at = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM answers AS a
                    WHERE a.run_id = r.id
                      AND a.parse_status = 'completed'
                ) THEN r.completed_at
                ELSE NULL
            END,
            parse_completed_at = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM answers AS a
                    WHERE a.run_id = r.id
                      AND a.parse_status = 'completed'
                ) THEN r.completed_at
                ELSE NULL
            END,
            score_started_at = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM answers AS a
                    WHERE a.run_id = r.id
                      AND a.score_status = 'completed'
                ) THEN r.completed_at
                ELSE NULL
            END,
            score_completed_at = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM answers AS a
                    WHERE a.run_id = r.id
                      AND a.score_status = 'completed'
                ) THEN r.completed_at
                ELSE NULL
            END
        """
    )

    op.alter_column("answers", "query_text", server_default=None)
    op.alter_column("answers", "engine_name", server_default=None)
    op.alter_column("answers", "engine_provider", server_default=None)
    op.alter_column("answers", "parse_status", server_default=None)
    op.alter_column("answers", "score_status", server_default=None)
    op.alter_column("engine_runs", "engine_status", server_default=None)
    op.alter_column("engine_runs", "parse_status", server_default=None)
    op.alter_column("engine_runs", "score_status", server_default=None)
    op.alter_column("engine_runs", "answers_expected", server_default=None)
    op.alter_column("engine_runs", "answers_completed", server_default=None)
    op.alter_column("engine_runs", "parse_completed", server_default=None)
    op.alter_column("engine_runs", "score_completed", server_default=None)
    op.alter_column("visibility_scores", "answer_id", nullable=False)
    op.create_unique_constraint(
        "uq_visibility_scores_answer_id",
        "visibility_scores",
        ["answer_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_visibility_scores_answer_id", "visibility_scores", type_="unique")
    op.drop_constraint(
        "fk_visibility_scores_answer_id_answers",
        "visibility_scores",
        type_="foreignkey",
    )
    op.drop_column("visibility_scores", "answer_id")

    op.drop_column("answers", "scored_at")
    op.drop_column("answers", "score_error")
    op.drop_column("answers", "score_status")
    op.drop_column("answers", "parsed_at")
    op.drop_column("answers", "parse_fingerprint")
    op.drop_column("answers", "parse_error")
    op.drop_column("answers", "parse_status")
    op.drop_column("answers", "engine_provider")
    op.drop_column("answers", "engine_name")
    op.drop_column("answers", "query_text")

    op.drop_column("engine_runs", "score_completed_at")
    op.drop_column("engine_runs", "score_started_at")
    op.drop_column("engine_runs", "parse_completed_at")
    op.drop_column("engine_runs", "parse_started_at")
    op.drop_column("engine_runs", "engine_completed_at")
    op.drop_column("engine_runs", "engine_started_at")
    op.drop_column("engine_runs", "score_completed")
    op.drop_column("engine_runs", "parse_completed")
    op.drop_column("engine_runs", "answers_completed")
    op.drop_column("engine_runs", "answers_expected")
    op.drop_column("engine_runs", "error_message")
    op.drop_column("engine_runs", "score_status")
    op.drop_column("engine_runs", "parse_status")
    op.drop_column("engine_runs", "engine_status")
