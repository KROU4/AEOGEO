"""Workflow: Content Audit Loop.

Runs periodically (every 6 hours) to find published content that needs
a post-publication visibility audit. For each qualifying content item,
triggers an EngineRun and starts the FullPipelineWorkflow to measure impact.
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
class ContentAuditInput:
    """Input for the ContentAuditWorkflow. Currently empty; the workflow
    discovers auditable content on its own."""

    pass


@dataclass
class ContentAuditResult:
    """Output from the ContentAuditWorkflow."""

    audited_count: int = 0
    run_ids: list[str] = field(default_factory=list)
    details: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------


@activity.defn
async def find_auditable_content_activity() -> list[str]:
    """Find content IDs that need a post-publication audit.

    Returns a list of content UUID strings.
    """
    activity.logger.info("find_auditable_content_activity: searching for auditable content")

    from app.dependencies import async_session
    from app.services.content_audit import ContentAuditService

    async with async_session() as db:
        service = ContentAuditService(db)
        content_items = await service.find_content_needing_audit()
        return [str(c.id) for c in content_items]


@activity.defn
async def trigger_audit_run_activity(content_id: str) -> list[str]:
    """Trigger audit runs for a content item.

    Returns a list of created EngineRun ID strings (one per active engine).
    """
    import uuid

    activity.logger.info("trigger_audit_run_activity: content_id=%s", content_id)

    from app.dependencies import async_session
    from app.services.content_audit import ContentAuditService

    async with async_session() as db:
        service = ContentAuditService(db)
        runs = await service.trigger_audit_run(uuid.UUID(content_id))
        await db.commit()
        return [str(r.id) for r in runs]


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------


@workflow.defn
class ContentAuditWorkflow:
    """Runs periodically (every 6 hours) to check for content needing audit.

    For each content item that was published 48+ hours ago and hasn't been
    audited yet:
    1. Trigger audit run(s) via activity
    2. Start FullPipelineWorkflow for each run to execute the measurement
    3. Collect results
    """

    @workflow.run
    async def run(self, input: ContentAuditInput) -> ContentAuditResult:
        workflow.logger.info("ContentAuditWorkflow started")

        # Step 1: Find content needing audit
        content_ids = await workflow.execute_activity(
            find_auditable_content_activity,
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        if not content_ids:
            workflow.logger.info("No content items need audit at this time")
            return ContentAuditResult(audited_count=0)

        workflow.logger.info(
            "Found %d content items needing audit", len(content_ids)
        )

        all_run_ids: list[str] = []
        details: list[dict[str, Any]] = []

        # Step 2: For each content item, trigger audit runs
        for content_id in content_ids:
            try:
                run_ids = await workflow.execute_activity(
                    trigger_audit_run_activity,
                    content_id,
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
            except Exception as exc:
                workflow.logger.error(
                    "Failed to trigger audit for content %s: %s",
                    content_id,
                    exc,
                )
                details.append({
                    "content_id": content_id,
                    "status": "failed",
                    "detail": f"Failed to trigger audit: {exc}",
                })
                continue

            if not run_ids:
                details.append({
                    "content_id": content_id,
                    "status": "skipped",
                    "detail": "No active engines or query sets for project",
                })
                continue

            all_run_ids.extend(run_ids)

            # Step 3: Start FullPipelineWorkflow for each run
            for run_id in run_ids:
                try:
                    pipeline_result = await workflow.execute_child_workflow(
                        "FullPipelineWorkflow",
                        PipelineInput(engine_run_id=run_id, sample_count=1),
                        id=f"content-audit-pipeline-{run_id}",
                        task_queue="aeogeo-pipeline",
                        execution_timeout=timedelta(hours=2),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                    details.append({
                        "content_id": content_id,
                        "run_id": run_id,
                        "status": pipeline_result.status,
                        "stages": pipeline_result.stages,
                    })
                except Exception as exc:
                    workflow.logger.error(
                        "FullPipelineWorkflow failed for audit run %s (content %s): %s",
                        run_id,
                        content_id,
                        exc,
                    )
                    details.append({
                        "content_id": content_id,
                        "run_id": run_id,
                        "status": "failed",
                        "detail": str(exc),
                    })

        workflow.logger.info(
            "ContentAuditWorkflow finished: audited %d content items, %d runs created",
            len(content_ids),
            len(all_run_ids),
        )

        return ContentAuditResult(
            audited_count=len(content_ids),
            run_ids=all_run_ids,
            details=details,
        )
