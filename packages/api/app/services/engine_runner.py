"""Engine Runner service — orchestrates engine runs and persists answers.

Responsibilities:
- Create / read / list EngineRun records
- Execute a single query against an engine via the engine_connector adapters
- Track run progress (total queries, completed answers)
- List answers for a run
"""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.answer import Answer
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.models.query import Query, QuerySet
from app.services.engine_connector import get_connector
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    encode_cursor,
    paginate_results,
)

logger = logging.getLogger(__name__)

_ACTIVE_STATUSES = {"running"}
_FAILED_STATUSES = {"failed"}
_SUCCESS_STATUSES = {"completed", "skipped"}
_PARTIAL_STATUSES = {"partial"}
_TERMINAL_STATUSES = _SUCCESS_STATUSES | _FAILED_STATUSES | _PARTIAL_STATUSES | {"cancelled"}


def derive_run_status(
    engine_status: str,
    parse_status: str,
    score_status: str,
) -> str:
    """Collapse stage statuses into a single externally-facing run status."""
    stages = [engine_status, parse_status, score_status]

    if engine_status == "pending" and parse_status == "pending" and score_status == "pending":
        return "pending"

    if any(status in _ACTIVE_STATUSES for status in stages):
        return "running"

    if engine_status in _SUCCESS_STATUSES | _PARTIAL_STATUSES and parse_status == "pending":
        return "running"

    if parse_status in _SUCCESS_STATUSES | _PARTIAL_STATUSES | _FAILED_STATUSES and score_status == "pending":
        return "running"

    if engine_status == "failed":
        return "failed"

    if any(status in _PARTIAL_STATUSES for status in stages):
        return "partial"

    downstream_failures = {parse_status, score_status} & _FAILED_STATUSES
    if downstream_failures:
        return "partial" if engine_status in _SUCCESS_STATUSES else "failed"

    if all(status == "pending" for status in stages):
        return "pending"

    if all(status in _SUCCESS_STATUSES for status in stages):
        return "completed"

    if engine_status == "pending" and parse_status == "pending" and score_status == "pending":
        return "pending"

    return "running"


class EngineRunnerService:
    """High-level service for managing engine runs and their answers."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # Run lifecycle
    # ------------------------------------------------------------------

    async def create_run(
        self,
        project_id: UUID,
        query_set_id: UUID,
        engine_id: UUID,
        sample_count: int = 1,
        triggered_by: str = "manual",
    ) -> EngineRun:
        """Create a new EngineRun record with status='pending'."""
        run = EngineRun(
            project_id=project_id,
            query_set_id=query_set_id,
            engine_id=engine_id,
            sample_count=max(1, min(sample_count, 10)),
            triggered_by=triggered_by,
            status="pending",
            engine_status="pending",
            parse_status="pending",
            score_status="pending",
        )
        self.session.add(run)
        await self.session.flush()
        await self.session.refresh(run)
        return run

    async def get_run(self, run_id: UUID) -> EngineRun | None:
        """Load a single run with eager-loaded answer count."""
        answer_count_sq = (
            select(func.count())
            .where(Answer.run_id == EngineRun.id)
            .correlate(EngineRun)
            .scalar_subquery()
        )

        result = await self.session.execute(
            select(EngineRun, answer_count_sq.label("answer_count"))
            .where(EngineRun.id == run_id)
            .options(
                selectinload(EngineRun.engine),
                selectinload(EngineRun.query_set),
            )
        )
        row = result.one_or_none()
        if row is None:
            return None

        run = row[0]
        # Attach answer count as a transient attribute for convenience
        run._answer_count = row[1] or 0  # type: ignore[attr-defined]
        return run

    async def list_runs(
        self,
        project_id: UUID,
        status: str | None = None,
        cursor: str | None = None,
        limit: int = 20,
    ) -> PaginatedResponse[EngineRun]:
        """Return paginated engine runs for a project, newest first."""
        answer_count_sq = (
            select(func.count())
            .where(Answer.run_id == EngineRun.id)
            .correlate(EngineRun)
            .scalar_subquery()
        )

        query = (
            select(EngineRun, answer_count_sq.label("answer_count"))
            .where(EngineRun.project_id == project_id)
            .options(
                selectinload(EngineRun.engine),
                selectinload(EngineRun.query_set),
            )
        )

        if status is not None:
            query = query.where(EngineRun.status == status)

        query = apply_cursor_pagination(query, EngineRun, cursor, limit)

        result = await self.session.execute(query)
        rows = result.all()

        items_raw, next_cursor, has_more = paginate_results(
            rows, limit, created_at_attr="created_at", id_attr="id"
        )

        items: list[EngineRun] = []
        for row in items_raw:
            run = row[0] if hasattr(row, "__getitem__") else row.EngineRun
            ac = row[1] if hasattr(row, "__getitem__") else row.answer_count
            run._answer_count = ac or 0  # type: ignore[attr-defined]
            items.append(run)

        # Recompute cursor from actual EngineRun objects
        if has_more and items:
            last_row = items_raw[-1]
            last_run = last_row[0] if hasattr(last_row, "__getitem__") else last_row.EngineRun
            next_cursor = encode_cursor(last_run.created_at, last_run.id)

        return PaginatedResponse(items=items, next_cursor=next_cursor, has_more=has_more)

    async def update_run_status(
        self,
        run_id: UUID,
        status: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        engine_status: str | None = None,
        parse_status: str | None = None,
        score_status: str | None = None,
        error_message: str | None = None,
        clear_error_message: bool = False,
        answers_expected: int | None = None,
        answers_completed: int | None = None,
        parse_completed: int | None = None,
        score_completed: int | None = None,
        engine_started_at: datetime | None = None,
        engine_completed_at: datetime | None = None,
        parse_started_at: datetime | None = None,
        parse_completed_at: datetime | None = None,
        score_started_at: datetime | None = None,
        score_completed_at: datetime | None = None,
    ) -> EngineRun | None:
        """Update stage state and keep the derived run status in sync."""
        result = await self.session.execute(
            select(EngineRun).where(EngineRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if run is None:
            return None

        derived_completed_at = completed_at
        if status is not None:
            run.status = status
        if engine_status is not None:
            run.engine_status = engine_status
        if parse_status is not None:
            run.parse_status = parse_status
        if score_status is not None:
            run.score_status = score_status
        if clear_error_message:
            run.error_message = None
        elif error_message is not None:
            run.error_message = error_message
        if answers_expected is not None:
            run.answers_expected = answers_expected
        if answers_completed is not None:
            run.answers_completed = answers_completed
        if parse_completed is not None:
            run.parse_completed = parse_completed
        if score_completed is not None:
            run.score_completed = score_completed
        if started_at is not None:
            run.started_at = started_at
        if engine_started_at is not None:
            run.engine_started_at = engine_started_at
        if engine_completed_at is not None:
            run.engine_completed_at = engine_completed_at
        if parse_started_at is not None:
            run.parse_started_at = parse_started_at
        if parse_completed_at is not None:
            run.parse_completed_at = parse_completed_at
        if score_started_at is not None:
            run.score_started_at = score_started_at
        if score_completed_at is not None:
            run.score_completed_at = score_completed_at

        run.status = derive_run_status(
            run.engine_status,
            run.parse_status,
            run.score_status,
        )

        if run.status in _TERMINAL_STATUSES:
            run.completed_at = (
                derived_completed_at or run.completed_at or datetime.utcnow()
            )
        elif derived_completed_at is None:
            run.completed_at = None

        await self.session.flush()
        return run

    async def reset_run_for_retry(self, run_id: UUID) -> EngineRun | None:
        """Clear derived artifacts so a terminal run can be executed again safely."""
        result = await self.session.execute(
            select(EngineRun).where(EngineRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if run is None:
            return None

        await self.session.execute(
            delete(Answer).where(Answer.run_id == run_id)
        )

        run.status = "pending"
        run.engine_status = "pending"
        run.parse_status = "pending"
        run.score_status = "pending"
        run.error_message = None
        run.answers_completed = 0
        run.parse_completed = 0
        run.score_completed = 0
        run.started_at = None
        run.completed_at = None
        run.engine_started_at = None
        run.engine_completed_at = None
        run.parse_started_at = None
        run.parse_completed_at = None
        run.score_started_at = None
        run.score_completed_at = None

        await self.session.flush()
        return run

    # ------------------------------------------------------------------
    # Query execution
    # ------------------------------------------------------------------

    async def execute_query(
        self,
        run_id: UUID,
        query: Query,
        engine: Engine,
        sample_count: int,
    ) -> list[Answer]:
        """Execute a query against an engine and persist Answer records.

        Uses the engine_connector factory to obtain the right adapter, calls
        it for *sample_count* samples, and saves one Answer per response.
        """
        connector = get_connector(engine)
        responses = await connector.execute(query.text, sample_count=sample_count)

        answers: list[Answer] = []
        for idx, resp in enumerate(responses):
            if not resp.text.strip() or resp.metadata.get("error"):
                continue
            answer = Answer(
                run_id=run_id,
                query_id=query.id,
                engine_id=engine.id,
                sample_index=idx,
                raw_response=resp.text,
                query_text=query.text,
                engine_name=engine.name,
                engine_provider=engine.provider,
                response_metadata=resp.metadata,
            )
            self.session.add(answer)
            answers.append(answer)

        await self.session.flush()
        return answers

    # ------------------------------------------------------------------
    # Progress / answers
    # ------------------------------------------------------------------

    async def get_run_progress(self, run_id: UUID) -> dict:
        """Compute progress for a run.

        Returns:
            {
                "run_id": ...,
                "total_queries": N,
                "completed_answers": M,
                "expected_answers": N * sample_count,
                "progress_pct": float 0..100,
                "status": "pending" | "running" | "completed" | "failed",
            }
        """
        # Load the run
        result = await self.session.execute(
            select(EngineRun).where(EngineRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if run is None:
            return {"error": "run_not_found"}

        # Count queries in the query set
        total_q = await self.session.scalar(
            select(func.count()).where(Query.query_set_id == run.query_set_id)
        )
        total_queries: int = total_q or 0

        # Count completed answers
        completed_a = await self.session.scalar(
            select(func.count()).where(Answer.run_id == run_id)
        )
        completed_answers: int = completed_a or 0

        expected = total_queries * run.sample_count
        progress_pct = (completed_answers / expected * 100) if expected > 0 else 0.0

        return {
            "run_id": str(run.id),
            "total_queries": total_queries,
            "completed_answers": completed_answers,
            "expected_answers": expected,
            "progress_pct": round(progress_pct, 1),
            "status": run.status,
        }

    async def list_answers(
        self,
        run_id: UUID,
        query_id: UUID | None = None,
        cursor: str | None = None,
        limit: int = 50,
    ) -> PaginatedResponse[Answer]:
        """List answers for a run, optionally filtered by query_id."""
        query = select(Answer).where(Answer.run_id == run_id)

        if query_id is not None:
            query = query.where(Answer.query_id == query_id)

        query = apply_cursor_pagination(query, Answer, cursor, limit)

        result = await self.session.execute(query)
        rows = result.scalars().all()

        items_list = list(rows)
        has_more = len(items_list) > limit
        items = items_list[:limit]

        next_cursor = None
        if has_more and items:
            last = items[-1]
            next_cursor = encode_cursor(last.created_at, last.id)

        return PaginatedResponse(items=items, next_cursor=next_cursor, has_more=has_more)

    # ------------------------------------------------------------------
    # Helpers used by workflow activities
    # ------------------------------------------------------------------

    async def load_queries_for_run(self, run_id: UUID) -> list[Query]:
        """Load all queries belonging to the run's query set."""
        result = await self.session.execute(
            select(EngineRun).where(EngineRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if run is None:
            return []

        q_result = await self.session.execute(
            select(Query)
            .where(Query.query_set_id == run.query_set_id)
            .where(Query.status == "approved")
            .order_by(Query.priority.desc(), Query.created_at.asc())
        )
        return list(q_result.scalars().all())

    async def load_engine_for_run(self, run_id: UUID) -> Engine | None:
        """Load the engine associated with a run."""
        result = await self.session.execute(
            select(EngineRun)
            .where(EngineRun.id == run_id)
            .options(selectinload(EngineRun.engine))
        )
        run = result.scalar_one_or_none()
        if run is None:
            return None
        return run.engine
