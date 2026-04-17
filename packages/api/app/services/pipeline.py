"""Background pipeline — replaces Temporal for the visibility measurement cycle.

Triggered from runs.py via FastAPI BackgroundTasks:
    background_tasks.add_task(run_full_pipeline, str(run.id))

Stages: RunEngine → ParseAnswers → ScoreRun → DispatchEvent
Each stage owns its own DB session (no request-scoped state).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.answer import Answer
from app.models.engine_run import EngineRun
from app.models.query import Query
from app.services.ai_key import AIKeyService
from app.services.engine_connector import get_connector
from app.services.engine_runner import EngineRunnerService

logger = logging.getLogger(__name__)

_CONCURRENCY_LIMIT = 5


def _make_factory() -> async_sessionmaker[AsyncSession]:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


async def run_full_pipeline(run_id: str) -> None:
    """Orchestrate RunEngine → ParseAnswers → ScoreRun → DispatchEvent."""
    run_uuid = UUID(run_id)
    factory = _make_factory()

    logger.info("Pipeline starting for run %s", run_id)
    try:
        engine_ok = await _engine_stage(run_uuid, factory)
        if not engine_ok:
            return
        await _parse_stage(run_uuid, factory)
        await _score_stage(run_uuid, factory)
        await _dispatch_event(run_uuid, factory)
        logger.info("Pipeline completed for run %s", run_id)
    except Exception:
        logger.exception("Unhandled pipeline error for run %s", run_id)
        try:
            async with factory() as db:
                run = await db.get(EngineRun, run_uuid)
                if run is not None and run.status not in {"completed", "partial"}:
                    run.status = "failed"
                    run.completed_at = datetime.now(UTC)
                    if not run.error_message:
                        run.error_message = "Unexpected pipeline error"
                await db.commit()
        except Exception:
            logger.exception("Failed to persist error state for run %s", run_id)


# ---------------------------------------------------------------------------
# Stage 1 — Run Engine
# ---------------------------------------------------------------------------


async def _engine_stage(
    run_uuid: UUID,
    factory: async_sessionmaker[AsyncSession],
) -> bool:
    """Execute all queries and save answers. Returns False if engine stage failed."""
    # Mark run as running
    async with factory() as db:
        svc = EngineRunnerService(db)
        await svc.update_run_status(
            run_uuid,
            engine_status="running",
            parse_status="pending",
            score_status="pending",
            clear_error_message=True,
            started_at=datetime.now(UTC),
            engine_started_at=datetime.now(UTC),
        )
        await db.commit()

    # Load run + engine + queries
    async with factory() as db:
        result = await db.execute(
            select(EngineRun)
            .where(EngineRun.id == run_uuid)
            .options(selectinload(EngineRun.engine))
        )
        run = result.scalar_one_or_none()
        if run is None:
            logger.error("EngineRun %s not found — aborting pipeline", run_uuid)
            return False

        q_result = await db.execute(
            select(Query)
            .where(
                Query.query_set_id == run.query_set_id,
                Query.status == "approved",
            )
            .order_by(Query.priority.desc(), Query.created_at.asc())
        )
        queries = list(q_result.scalars().all())
        engine = run.engine
        sample_count = run.sample_count

        key_service = AIKeyService(db)
        resolved_provider = engine.provider
        resolved_model = engine.model_name
        api_key, used_openrouter = key_service.resolve_key_meta(engine.provider)

        if api_key and used_openrouter and engine.provider != "openrouter":
            resolved_provider = "openrouter"
            _fallback = {
                "openai": "openai/gpt-4o-mini",
                "anthropic": "anthropic/claude-haiku-4.5",
                "google": "google/gemini-2.5-flash",
            }
            if resolved_model and "/" not in resolved_model:
                resolved_model = f"{engine.provider}/{resolved_model}"
            elif not resolved_model:
                resolved_model = _fallback.get(engine.provider, f"{engine.provider}/default")

        adapter_config = engine.adapter_config or {}
        needs_key = adapter_config.get("type") != "scraper"
        if api_key is None and needs_key:
            async with factory() as db2:
                svc = EngineRunnerService(db2)
                await svc.update_run_status(
                    run_uuid,
                    engine_status="failed",
                    error_message=f"No API key for provider '{engine.provider}'",
                    set_completed=True,
                    engine_completed_at=datetime.now(UTC),
                )
                await db2.commit()
            return False

        engine_meta = {
            "id": str(engine.id),
            "name": engine.name,
            "provider": resolved_provider,
            "model_name": resolved_model,
            "adapter_config": engine.adapter_config,
            "api_key": api_key,
        }

    if not queries:
        async with factory() as db:
            svc = EngineRunnerService(db)
            await svc.update_run_status(
                run_uuid,
                engine_status="completed",
                engine_completed_at=datetime.now(UTC),
            )
            await db.commit()
        return True

    # Update expected count
    async with factory() as db:
        svc = EngineRunnerService(db)
        await svc.update_run_status(
            run_uuid,
            answers_expected=len(queries) * sample_count,
            answers_completed=0,
        )
        await db.commit()

    # Execute queries with bounded concurrency
    semaphore = asyncio.Semaphore(_CONCURRENCY_LIMIT)
    total_answers = 0
    failed_queries = 0
    last_error: str | None = None

    class _EngineProxy:
        def __init__(self) -> None:
            self.provider = engine_meta["provider"]
            self.model_name = engine_meta.get("model_name")
            self.adapter_config = engine_meta.get("adapter_config")
            self.name = engine_meta["name"]

    async def _run_one(q: Query) -> tuple[int, str | None]:
        async with semaphore:
            try:
                connector = get_connector(_EngineProxy(), api_key=engine_meta.get("api_key"))
                responses = await connector.execute(q.text, sample_count=sample_count)
                valid = [r for r in responses if r.text.strip() and not r.metadata.get("error")]
                if not valid:
                    return 0, "All samples failed or empty"
                async with factory() as db:
                    await db.execute(
                        delete(Answer).where(
                            Answer.run_id == run_uuid,
                            Answer.query_id == q.id,
                            Answer.engine_id == UUID(engine_meta["id"]),
                        )
                    )
                    for idx, resp in enumerate(valid):
                        db.add(Answer(
                            run_id=run_uuid,
                            query_id=q.id,
                            engine_id=UUID(engine_meta["id"]),
                            sample_index=idx,
                            raw_response=resp.text,
                            query_text=q.text,
                            engine_name=engine_meta["name"],
                            engine_provider=engine_meta["provider"],
                            response_metadata={
                                **resp.metadata,
                                "query_text": q.text,
                                "engine_name": engine_meta["name"],
                                "engine_provider": engine_meta["provider"],
                            },
                        ))
                    await db.commit()
                return len(valid), None
            except Exception as exc:
                logger.warning("Query %s failed: %s", q.id, exc)
                return 0, str(exc)

    tasks = [asyncio.create_task(_run_one(q)) for q in queries]
    for coro in asyncio.as_completed(tasks):
        saved, err = await coro
        total_answers += saved
        if err:
            failed_queries += 1
            last_error = err
        try:
            async with factory() as db:
                svc = EngineRunnerService(db)
                await svc.update_run_status(run_uuid, answers_completed=total_answers)
                await db.commit()
        except Exception:
            logger.warning("Failed to update progress for run %s", run_uuid)

    all_failed = failed_queries == len(queries)
    engine_status = "failed" if all_failed else ("partial" if failed_queries else "completed")

    async with factory() as db:
        svc = EngineRunnerService(db)
        await svc.update_run_status(
            run_uuid,
            engine_status=engine_status,
            error_message=(f"{failed_queries} queries failed" if failed_queries and not all_failed else last_error) if failed_queries else None,
            engine_completed_at=datetime.now(UTC),
            set_completed=all_failed,
        )
        await db.commit()

    if all_failed:
        logger.error("Engine stage failed for run %s: all queries failed", run_uuid)
        return False
    return True


# ---------------------------------------------------------------------------
# Stage 2 — Parse Answers
# ---------------------------------------------------------------------------


async def _parse_stage(
    run_uuid: UUID,
    factory: async_sessionmaker[AsyncSession],
) -> None:
    async with factory() as db:
        svc = EngineRunnerService(db)
        await svc.update_run_status(
            run_uuid,
            parse_status="running",
            parse_started_at=datetime.now(UTC),
        )
        await db.commit()

    try:
        from app.services.ai_key import AIKeyService
        from app.services.parse_runner import ParseRunnerService

        settings = get_settings()
        async with factory() as db:
            key_service = AIKeyService(db)
            base_url = "https://api.openai.com/v1/chat/completions"
            api_key, used_openrouter = key_service.resolve_key_meta("openai")
            if api_key and used_openrouter:
                base_url = "https://openrouter.ai/api/v1/chat/completions"

            redis = Redis.from_url(settings.redis_url, decode_responses=True)
            try:
                service = ParseRunnerService(db=db, redis=redis, api_key=api_key, base_url=base_url)
                result = await service.parse_run_answers(run_id=run_uuid, batch_size=20)
            finally:
                await redis.aclose()

        errors = result.get("errors", 0)
        parsed = result.get("parsed", 0)
        skipped = result.get("skipped", 0)
        parse_status = "partial" if errors else "completed"

        async with factory() as db:
            svc = EngineRunnerService(db)
            await svc.update_run_status(
                run_uuid,
                parse_status=parse_status,
                parse_completed=parsed + skipped,
                error_message=f"parse: {errors} answers failed" if errors else None,
                parse_completed_at=datetime.now(UTC),
            )
            await db.commit()

    except Exception as exc:
        logger.exception("Parse stage failed for run %s", run_uuid)
        async with factory() as db:
            svc = EngineRunnerService(db)
            await svc.update_run_status(
                run_uuid,
                parse_status="failed",
                error_message=f"parse: {exc}"[:2000],
                parse_completed_at=datetime.now(UTC),
            )
            await db.commit()


# ---------------------------------------------------------------------------
# Stage 3 — Score Run
# ---------------------------------------------------------------------------


async def _score_stage(
    run_uuid: UUID,
    factory: async_sessionmaker[AsyncSession],
) -> None:
    async with factory() as db:
        svc = EngineRunnerService(db)
        await svc.update_run_status(
            run_uuid,
            score_status="running",
            score_started_at=datetime.now(UTC),
        )
        await db.commit()

    try:
        from app.services.scoring import ScoringService

        async with factory() as db:
            service = ScoringService(db=db)
            result = await service.score_run(run_id=run_uuid)

        errors = result.get("errors", 0)
        score_status = "partial" if errors else "completed"

        async with factory() as db:
            svc = EngineRunnerService(db)
            await svc.update_run_status(
                run_uuid,
                score_status=score_status,
                score_completed=result.get("total_scored", 0),
                error_message=f"score: {errors} answers failed" if errors else None,
                score_completed_at=datetime.now(UTC),
                set_completed=True,
                set_score_completed=True,
            )
            await db.commit()

    except Exception as exc:
        logger.exception("Score stage failed for run %s", run_uuid)
        async with factory() as db:
            svc = EngineRunnerService(db)
            await svc.update_run_status(
                run_uuid,
                score_status="failed",
                error_message=f"score: {exc}"[:2000],
                score_completed_at=datetime.now(UTC),
                set_completed=True,
            )
            await db.commit()


# ---------------------------------------------------------------------------
# Stage 4 — Dispatch Completion Event
# ---------------------------------------------------------------------------


async def _dispatch_event(
    run_uuid: UUID,
    factory: async_sessionmaker[AsyncSession],
) -> None:
    try:
        from app.services.integration_events import dispatch_run_completed_event

        async with factory() as db:
            await dispatch_run_completed_event(db=db, run_id=run_uuid)
    except Exception as exc:
        logger.warning("Failed to dispatch run completion event for run %s: %s", run_uuid, exc)
