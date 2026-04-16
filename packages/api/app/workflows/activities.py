"""Temporal activity implementations for the AEOGEO pipeline."""

from __future__ import annotations

from uuid import UUID

from temporalio import activity

from app.dependencies import async_session


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
async def dispatch_run_completed_event_activity(run_id: str) -> None:
    """Send outbound integration events when a run reaches completion."""
    activity.logger.info("dispatch_run_completed_event_activity: run_id=%s", run_id)

    from app.services.integration_events import dispatch_run_completed_event

    async with async_session() as db:
        await dispatch_run_completed_event(db=db, run_id=UUID(run_id))
