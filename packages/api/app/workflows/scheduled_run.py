"""Workflow: Scheduled periodic visibility run.

Triggered on a cron schedule (via Temporal's built-in cron support)
to automatically re-measure AI visibility for a project.

For each engine_id in the schedule configuration, creates an EngineRun
record and starts a FullPipelineWorkflow as a child workflow.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.workflows.full_pipeline import PipelineInput


# ---------------------------------------------------------------------------
# Input / Output dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ScheduledRunInput:
    """Input for the scheduled run workflow."""

    schedule_id: str
    project_id: str
    query_set_id: str
    engine_ids: list[str]
    sample_count: int = 1


@dataclass
class ScheduledRunResult:
    """Output from the scheduled run workflow."""

    schedule_id: str
    engine_run_ids: list[str] = field(default_factory=list)
    status: str = "completed"  # "completed", "partial", "failed"
    details: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------


@activity.defn
async def create_engine_run_activity(
    project_id: str,
    query_set_id: str,
    engine_id: str,
    sample_count: int,
) -> str:
    """Create an EngineRun record in the DB and return its ID."""
    import uuid

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import get_settings
    from app.models.engine_run import EngineRun

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        run = EngineRun(
            status="pending",
            sample_count=sample_count,
            triggered_by="schedule",
            query_set_id=uuid.UUID(query_set_id),
            engine_id=uuid.UUID(engine_id),
            project_id=uuid.UUID(project_id),
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)
        run_id = str(run.id)

    await engine.dispose()
    return run_id


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------


@workflow.defn
class ScheduledRunWorkflow:
    """Periodically execute the full pipeline for a project.

    For each engine_id in the schedule configuration:
    1. Create an EngineRun record via activity
    2. Start FullPipelineWorkflow as a child workflow
    3. Collect results and return summary
    """

    @workflow.run
    async def run(self, input: ScheduledRunInput) -> ScheduledRunResult:
        workflow.logger.info(
            "ScheduledRunWorkflow started for schedule=%s project=%s with %d engines",
            input.schedule_id,
            input.project_id,
            len(input.engine_ids),
        )

        engine_run_ids: list[str] = []
        details: list[dict[str, Any]] = []

        for engine_id in input.engine_ids:
            # Step 1: Create EngineRun record
            try:
                run_id = await workflow.execute_activity(
                    create_engine_run_activity,
                    args=[
                        input.project_id,
                        input.query_set_id,
                        engine_id,
                        input.sample_count,
                    ],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
            except Exception as exc:
                workflow.logger.error(
                    "Failed to create EngineRun for engine %s: %s",
                    engine_id,
                    exc,
                )
                details.append({
                    "engine_id": engine_id,
                    "status": "failed",
                    "detail": f"Failed to create run: {exc}",
                })
                continue

            engine_run_ids.append(run_id)

            # Step 2: Start FullPipelineWorkflow as child workflow
            try:
                pipeline_result = await workflow.execute_child_workflow(
                    "FullPipelineWorkflow",
                    PipelineInput(
                        engine_run_id=run_id,
                        sample_count=input.sample_count,
                    ),
                    id=f"scheduled-pipeline-{run_id}",
                    task_queue="aeogeo-pipeline",
                    execution_timeout=timedelta(hours=2),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                details.append({
                    "engine_id": engine_id,
                    "run_id": run_id,
                    "status": pipeline_result.status,
                    "stages": pipeline_result.stages,
                })
            except Exception as exc:
                workflow.logger.error(
                    "FullPipelineWorkflow failed for run %s (engine %s): %s",
                    run_id,
                    engine_id,
                    exc,
                )
                details.append({
                    "engine_id": engine_id,
                    "run_id": run_id,
                    "status": "failed",
                    "detail": str(exc),
                })

        # Determine overall status
        statuses = {d.get("status") for d in details}
        if not details:
            overall = "failed"
        elif all(s == "completed" for s in statuses):
            overall = "completed"
        elif all(s == "failed" for s in statuses):
            overall = "failed"
        else:
            overall = "partial"

        workflow.logger.info(
            "ScheduledRunWorkflow for schedule=%s finished: %s (%d engines)",
            input.schedule_id,
            overall,
            len(engine_run_ids),
        )

        return ScheduledRunResult(
            schedule_id=input.schedule_id,
            engine_run_ids=engine_run_ids,
            status=overall,
            details=details,
        )
