"""Workflow: Run queries against a single AI engine.

Orchestrates the execution of all queries in a query set against one engine,
saving raw answers for downstream parsing and scoring.

Input:  RunEngineInput (engine_run_id, sample_count)
Output: RunEngineResult (run_id, total_answers, failed_queries)
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from uuid import UUID

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from sqlalchemy import delete, select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.orm import selectinload

    from app.config import Settings
    from app.models.answer import Answer
    from app.models.engine import Engine
    from app.models.engine_run import EngineRun
    from app.models.project import Project
    from app.models.query import Query
    from app.services.ai_key import AIKeyService
    from app.services.engine_connector import get_connector
    from app.services.engine_runner import EngineRunnerService

logger = logging.getLogger(__name__)

# Maximum concurrent engine API calls per workflow execution
_CONCURRENCY_LIMIT = 5


# ---------------------------------------------------------------------------
# Input / Output dataclasses (must be serializable by Temporal)
# ---------------------------------------------------------------------------


@dataclass
class RunEngineInput:
    """Input for RunEngineWorkflow."""

    engine_run_id: str  # UUID as string for serialization
    sample_count: int = 1


@dataclass
class RunEngineResult:
    """Output from RunEngineWorkflow."""

    run_id: str
    total_answers: int = 0
    failed_queries: int = 0
    status: str = "completed"


# ---------------------------------------------------------------------------
# Activity input/output dataclasses
# ---------------------------------------------------------------------------


@dataclass
class UpdateStatusInput:
    run_id: str
    engine_status: str | None = None
    parse_status: str | None = None
    score_status: str | None = None
    error_message: str | None = None
    clear_error_message: bool = False
    answers_expected: int | None = None
    answers_completed: int | None = None
    parse_completed: int | None = None
    score_completed: int | None = None
    set_started: bool = False
    set_completed: bool = False
    set_engine_started: bool = False
    set_engine_completed: bool = False
    set_parse_started: bool = False
    set_parse_completed: bool = False
    set_score_started: bool = False
    set_score_completed: bool = False


@dataclass
class LoadRunQueriesResult:
    """Serializable representation of the queries + engine for a run."""

    queries: list[dict] = field(default_factory=list)  # [{id, text, category, priority}]
    engine: dict = field(default_factory=dict)  # {id, name, provider, model_name, adapter_config}
    sample_count: int = 1


@dataclass
class ExecuteQueryInput:
    run_id: str
    query_id: str
    query_text: str
    engine_id: str
    engine_name: str
    engine_provider: str
    engine_model_name: str | None = None
    engine_adapter_config: dict | None = None
    api_key: str | None = None
    sample_count: int = 1


@dataclass
class ExecuteQueryResult:
    answers_saved: int = 0
    failed_samples: int = 0
    error: str | None = None


# ---------------------------------------------------------------------------
# Helper: get a DB session outside of FastAPI request context
# ---------------------------------------------------------------------------


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create a standalone session factory for activities (not request-scoped)."""
    settings = Settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------


@activity.defn
async def update_run_status_activity(input: UpdateStatusInput) -> None:
    """Update the pipeline state of an engine run."""
    factory = _make_session_factory()
    async with factory() as session:
        svc = EngineRunnerService(session)
        started_at = datetime.utcnow() if input.set_started else None
        completed_at = datetime.utcnow() if input.set_completed else None
        await svc.update_run_status(
            run_id=UUID(input.run_id),
            started_at=started_at,
            completed_at=completed_at,
            engine_status=input.engine_status,
            parse_status=input.parse_status,
            score_status=input.score_status,
            error_message=input.error_message,
            clear_error_message=input.clear_error_message,
            answers_expected=input.answers_expected,
            answers_completed=input.answers_completed,
            parse_completed=input.parse_completed,
            score_completed=input.score_completed,
            engine_started_at=datetime.utcnow() if input.set_engine_started else None,
            engine_completed_at=datetime.utcnow() if input.set_engine_completed else None,
            parse_started_at=datetime.utcnow() if input.set_parse_started else None,
            parse_completed_at=datetime.utcnow() if input.set_parse_completed else None,
            score_started_at=datetime.utcnow() if input.set_score_started else None,
            score_completed_at=datetime.utcnow() if input.set_score_completed else None,
        )
        await session.commit()
    activity.logger.info("Updated pipeline state for run %s", input.run_id)


@activity.defn
async def load_run_queries_activity(run_id: str) -> LoadRunQueriesResult:
    """Load all queries and the engine config for a given run."""
    factory = _make_session_factory()
    async with factory() as session:
        # Load the run with its engine
        result = await session.execute(
            select(EngineRun)
            .where(EngineRun.id == UUID(run_id))
            .options(selectinload(EngineRun.engine))
        )
        run = result.scalar_one_or_none()
        if run is None:
            raise ValueError(f"EngineRun {run_id} not found")

        # Load queries
        q_result = await session.execute(
            select(Query)
            .where(Query.query_set_id == run.query_set_id)
            .where(Query.status == "approved")
            .order_by(Query.priority.desc(), Query.created_at.asc())
        )
        queries = q_result.scalars().all()

        engine = run.engine

        # Resolve API key from database.
        # Two-step: try exact provider first, then OpenRouter fallback.
        # When falling back to OpenRouter, override provider so get_connector
        # routes through OpenRouter instead of the native API.
        project_result = await session.execute(
            select(Project).where(Project.id == run.project_id)
        )
        project = project_result.scalar_one()
        key_service = AIKeyService(session)

        resolved_provider = engine.provider
        resolved_model = engine.model_name

        # Step 1: exact provider key (tenant → global)
        exact_key = await key_service._find_active_key(engine.provider, project.tenant_id)
        if not exact_key:
            exact_key = await key_service._find_active_key(engine.provider, None)

        if exact_key:
            api_key = key_service._decrypt_and_mark(exact_key)
        elif engine.provider not in ("openrouter",):
            # Step 2: OpenRouter fallback — switch routing to OpenRouter
            or_key = await key_service._find_active_key("openrouter", project.tenant_id)
            if not or_key:
                or_key = await key_service._find_active_key("openrouter", None)
            if or_key:
                api_key = key_service._decrypt_and_mark(or_key)
                resolved_provider = "openrouter"
                # OpenRouter uses {provider}/{model} format
                _PROVIDER_DEFAULT_MODELS = {
                    "openai": "openai/gpt-5.4-mini",
                    "anthropic": "anthropic/claude-haiku-4.5",
                    "google": "google/gemini-2.5-flash",
                }
                if resolved_model and "/" not in resolved_model:
                    resolved_model = f"{engine.provider}/{resolved_model}"
                elif not resolved_model:
                    resolved_model = _PROVIDER_DEFAULT_MODELS.get(
                        engine.provider, f"{engine.provider}/default"
                    )
            else:
                api_key = None
        else:
            api_key = None

        # Fail early with a clear message if no key is available
        adapter_config = engine.adapter_config or {}
        needs_key = not (adapter_config.get("type") == "scraper")
        if api_key is None and needs_key:
            raise ValueError(
                f"No API key configured for provider '{engine.provider}'. "
                f"Add one in Admin > API Keys."
            )

        return LoadRunQueriesResult(
            queries=[
                {
                    "id": str(q.id),
                    "text": q.text,
                    "category": q.category,
                    "priority": q.priority,
                }
                for q in queries
            ],
            engine={
                "id": str(engine.id),
                "name": engine.name,
                "provider": resolved_provider,
                "model_name": resolved_model,
                "adapter_config": engine.adapter_config,
                "api_key": api_key,
            },
            sample_count=run.sample_count,
        )


@activity.defn
async def execute_single_query_activity(input: ExecuteQueryInput) -> ExecuteQueryResult:
    """Execute a single query against an engine and save Answer records."""
    factory = _make_session_factory()

    try:
        # Build a lightweight engine-like object for get_connector
        class _EngineProxy:
            def __init__(self, provider: str, model_name: str | None, adapter_config: dict | None, name: str = ""):
                self.provider = provider
                self.model_name = model_name
                self.adapter_config = adapter_config
                self.name = name

        engine_proxy = _EngineProxy(
            provider=input.engine_provider,
            model_name=input.engine_model_name,
            adapter_config=input.engine_adapter_config,
        )
        connector = get_connector(engine_proxy, api_key=input.api_key)
        responses = await connector.execute(input.query_text, sample_count=input.sample_count)

        valid_responses = [
            resp for resp in responses
            if resp.text.strip() and not resp.metadata.get("error")
        ]
        failed_samples = len(responses) - len(valid_responses)

        if not valid_responses:
            return ExecuteQueryResult(
                answers_saved=0,
                failed_samples=failed_samples or input.sample_count,
                error="All samples failed",
            )

        # Persist answers, replacing prior answers for this query/run/engine.
        async with factory() as session:
            await session.execute(
                delete(Answer).where(
                    Answer.run_id == UUID(input.run_id),
                    Answer.query_id == UUID(input.query_id),
                    Answer.engine_id == UUID(input.engine_id),
                )
            )
            for idx, resp in enumerate(valid_responses):
                answer = Answer(
                    run_id=UUID(input.run_id),
                    query_id=UUID(input.query_id),
                    engine_id=UUID(input.engine_id),
                    sample_index=idx,
                    raw_response=resp.text,
                    query_text=input.query_text,
                    engine_name=input.engine_name,
                    engine_provider=input.engine_provider,
                    response_metadata={
                        **resp.metadata,
                        "query_text": input.query_text,
                        "engine_name": input.engine_name,
                        "engine_provider": input.engine_provider,
                    },
                )
                session.add(answer)
            await session.commit()

        activity.logger.info(
            "Saved %d answers for query %s (run %s); failed_samples=%d",
            len(valid_responses),
            input.query_id,
            input.run_id,
            failed_samples,
        )
        return ExecuteQueryResult(
            answers_saved=len(valid_responses),
            failed_samples=failed_samples,
            error=None,
        )

    except Exception as exc:
        activity.logger.error(
            "Failed to execute query %s: %s", input.query_id, exc
        )
        return ExecuteQueryResult(answers_saved=0, error=str(exc))


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------


@workflow.defn
class RunEngineWorkflow:
    """Execute all queries in a query set against a single AI engine.

    Steps:
    1. Mark run as "running"
    2. Load queries for the run's query set
    3. For each query, execute via activity (bounded concurrency)
    4. Mark run as "completed" (or "failed" on error)
    """

    @workflow.run
    async def run(self, input: RunEngineInput) -> RunEngineResult:
        run_id = input.engine_run_id

        # ---- Step 1: Mark as running ----
        try:
            await workflow.execute_activity(
                update_run_status_activity,
                UpdateStatusInput(
                    run_id=run_id,
                    engine_status="running",
                    parse_status="pending",
                    score_status="pending",
                    clear_error_message=True,
                    set_started=True,
                    set_engine_started=True,
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception as exc:
            workflow.logger.error("Failed to mark run as running: %s", exc)
            return RunEngineResult(run_id=run_id, status="failed")

        # ---- Step 2: Load queries + engine config ----
        try:
            run_data: LoadRunQueriesResult = await workflow.execute_activity(
                load_run_queries_activity,
                run_id,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception as exc:
            workflow.logger.error("Failed to load run queries: %s", exc)
            await self._mark_failed(run_id, error_message=str(exc))
            return RunEngineResult(run_id=run_id, status="failed")

        try:
            await workflow.execute_activity(
                update_run_status_activity,
                UpdateStatusInput(
                    run_id=run_id,
                    answers_expected=len(run_data.queries) * run_data.sample_count,
                    answers_completed=0,
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception:
            workflow.logger.warning("Failed to persist expected answer count for run %s", run_id)

        if not run_data.queries:
            workflow.logger.warning("No queries found for run %s", run_id)
            await self._mark_completed(run_id)
            return RunEngineResult(run_id=run_id, total_answers=0, status="completed")

        # ---- Step 3: Execute queries with bounded concurrency ----
        semaphore = asyncio.Semaphore(_CONCURRENCY_LIMIT)
        total_answers = 0
        failed_queries = 0
        last_error: str | None = None

        async def _run_query(q: dict) -> ExecuteQueryResult:
            async with semaphore:
                return await workflow.execute_activity(
                    execute_single_query_activity,
                    ExecuteQueryInput(
                        run_id=run_id,
                        query_id=q["id"],
                        query_text=q["text"],
                        engine_id=run_data.engine["id"],
                        engine_name=run_data.engine["name"],
                        engine_provider=run_data.engine["provider"],
                        engine_model_name=run_data.engine.get("model_name"),
                        engine_adapter_config=run_data.engine.get("adapter_config"),
                        api_key=run_data.engine.get("api_key"),
                        sample_count=run_data.sample_count,
                    ),
                    start_to_close_timeout=timedelta(minutes=3),
                    retry_policy=RetryPolicy(
                        maximum_attempts=3,
                        initial_interval=timedelta(seconds=2),
                        maximum_interval=timedelta(seconds=30),
                        backoff_coefficient=2.0,
                        non_retryable_error_types=["ValueError"],
                    ),
                )

        tasks = [asyncio.create_task(_run_query(q)) for q in run_data.queries]

        for finished in asyncio.as_completed(tasks):
            try:
                result = await finished
            except Exception as exc:
                failed_queries += 1
                last_error = str(exc)
                workflow.logger.error("Query execution exception: %s", exc)
            else:
                total_answers += result.answers_saved
                if result.error is not None:
                    failed_queries += 1
                    last_error = result.error

            try:
                await workflow.execute_activity(
                    update_run_status_activity,
                    UpdateStatusInput(
                        run_id=run_id,
                        answers_completed=total_answers,
                    ),
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
            except Exception:
                workflow.logger.warning("Failed to update progress for run %s", run_id)

        # ---- Step 4: Mark completed or failed ----
        if failed_queries == len(run_data.queries):
            # All queries failed
            error_msg = last_error or "Engine execution failed"
            await self._mark_failed(run_id, error_message=error_msg)
            return RunEngineResult(
                run_id=run_id,
                total_answers=total_answers,
                failed_queries=failed_queries,
                status="failed",
            )

        if failed_queries:
            await self._mark_partial(
                run_id,
                error_message=f"{failed_queries} queries failed during engine execution",
            )
        else:
            await self._mark_completed(run_id)
        return RunEngineResult(
            run_id=run_id,
            total_answers=total_answers,
            failed_queries=failed_queries,
            status="partial" if failed_queries else "completed",
        )

    # ---- Internal helpers ----

    async def _mark_failed(self, run_id: str, error_message: str = "Engine execution failed") -> None:
        try:
            await workflow.execute_activity(
                update_run_status_activity,
                UpdateStatusInput(
                    run_id=run_id,
                    engine_status="failed",
                    error_message=error_message,
                    set_completed=True,
                    set_engine_completed=True,
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception:
            workflow.logger.error("Could not mark run %s as failed", run_id)

    async def _mark_completed(self, run_id: str) -> None:
        try:
            await workflow.execute_activity(
                update_run_status_activity,
                UpdateStatusInput(
                    run_id=run_id,
                    engine_status="completed",
                    set_completed=True,
                    set_engine_completed=True,
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception:
            workflow.logger.error("Could not mark run %s as completed", run_id)

    async def _mark_partial(self, run_id: str, error_message: str) -> None:
        try:
            await workflow.execute_activity(
                update_run_status_activity,
                UpdateStatusInput(
                    run_id=run_id,
                    engine_status="partial",
                    error_message=error_message,
                    set_completed=True,
                    set_engine_completed=True,
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception:
            workflow.logger.error("Could not mark run %s as partial", run_id)
