"""Temporal activity implementations for the AEOGEO pipeline."""

from __future__ import annotations

from uuid import UUID

from temporalio import activity

from app.dependencies import async_session


@activity.defn
async def crawl_engine_activity(engine: str, query: str) -> dict:
    """Reserved — not used by current workflows."""
    activity.logger.info("crawl_engine_activity (noop): engine=%s query=%s", engine, query)
    return {}


@activity.defn
async def parse_answers_activity(run_id: str) -> dict:
    """Parse all answers for an engine run into structured mention/citation data."""
    activity.logger.info("parse_answers_activity: run_id=%s", run_id)

    from redis.asyncio import Redis

    from app.config import Settings
    from app.services.parse_runner import ParseRunnerService

    settings = Settings()

    async with async_session() as db:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            service = ParseRunnerService(db=db, redis=redis)
            result = await service.parse_run_answers(run_id=UUID(run_id))
            return result
        finally:
            await redis.aclose()


@activity.defn
async def score_run_activity(run_id: str) -> dict:
    """Compute visibility scores for a completed pipeline run."""
    activity.logger.info("score_run_activity: run_id=%s", run_id)

    from app.services.scoring import ScoringService

    async with async_session() as db:
        service = ScoringService(db=db)
        result = await service.score_run(run_id=UUID(run_id))
        return result


@activity.defn
async def ingest_document_activity(document_path: str, tenant_id: str) -> dict:
    """Reserved — knowledge ingestion removed from product scope."""
    activity.logger.info(
        "ingest_document_activity (noop): path=%s tenant=%s", document_path, tenant_id
    )
    return {}
