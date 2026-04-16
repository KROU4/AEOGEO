"""Workflow: Full visibility measurement pipeline.

Orchestrates the complete measurement cycle by chaining child workflows:
  1. RunEngineWorkflow  -- query engines, save raw answers
  2. ParseAnswersWorkflow -- extract mentions, citations, sentiment
  3. ScoreRunWorkflow -- compute visibility scores

This is the top-level workflow that API endpoints trigger to start a run.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

# Import child workflow types through the sandbox pass-through so Temporal
# can resolve them during registration.
with workflow.unsafe.imports_passed_through():
    from app.workflows.parse_answers import ParseInput, ParseResult
    from app.workflows.run_engine import (
        RunEngineInput,
        RunEngineResult,
        UpdateStatusInput,
        update_run_status_activity,
    )
    from app.workflows.score_run import ScoreInput, ScoreResult
    from app.workflows.activities import dispatch_run_completed_event_activity

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Input / Output dataclasses
# ---------------------------------------------------------------------------


@dataclass
class PipelineInput:
    """Input for the full pipeline workflow."""

    engine_run_id: str  # UUID as string
    sample_count: int = 1
    # Future: parse and score options
    skip_parse: bool = False
    skip_score: bool = False


@dataclass
class PipelineStageResult:
    """Outcome of a single pipeline stage."""

    stage: str
    status: str  # "completed", "failed", "skipped"
    detail: str = ""


@dataclass
class PipelineResult:
    """Output from the full pipeline workflow."""

    run_id: str
    status: str = "completed"  # "completed", "partial", "failed"
    stages: list[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------


@workflow.defn
class FullPipelineWorkflow:
    """End-to-end visibility measurement pipeline.

    Chains RunEngine -> ParseAnswers -> ScoreRun as child workflows.
    If a downstream stage (ParseAnswers, ScoreRun) doesn't exist yet or
    fails, the pipeline still reports success for the stages that ran.
    RunEngine failure causes the entire pipeline to fail.
    """

    @workflow.run
    async def run(self, input: PipelineInput) -> PipelineResult:
        run_id = input.engine_run_id
        stages: list[dict] = []

        # ----------------------------------------------------------------
        # Stage 1: Run Engine (required -- failure = pipeline failure)
        # ----------------------------------------------------------------
        workflow.logger.info(
            "Pipeline starting for run %s: RunEngine stage", run_id
        )

        try:
            engine_result: RunEngineResult = await workflow.execute_child_workflow(
                "RunEngineWorkflow",
                RunEngineInput(
                    engine_run_id=run_id,
                    sample_count=input.sample_count,
                ),
                id=f"run-engine-{run_id}",
                task_queue="aeogeo-pipeline",
                execution_timeout=timedelta(hours=1),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception as exc:
            workflow.logger.error("RunEngine stage failed: %s", exc)
            stages.append({
                "stage": "run_engine",
                "status": "failed",
                "detail": str(exc),
            })
            return PipelineResult(
                run_id=run_id,
                status="failed",
                stages=stages,
            )

        # Temporal may deserialize child workflow results as plain dicts
        if isinstance(engine_result, dict):
            engine_result = RunEngineResult(**engine_result)

        stages.append({
            "stage": "run_engine",
            "status": engine_result.status,
            "detail": (
                f"answers={engine_result.total_answers}, "
                f"failed_queries={engine_result.failed_queries}"
            ),
        })

        if engine_result.status == "failed":
            return PipelineResult(
                run_id=run_id,
                status="failed",
                stages=stages,
            )

        # ----------------------------------------------------------------
        # Stage 2: Parse Answers (optional -- skip or fail gracefully)
        # ----------------------------------------------------------------
        if input.skip_parse:
            await self._update_stage_state(
                run_id,
                UpdateStatusInput(
                    run_id=run_id,
                    parse_status="skipped",
                    set_parse_completed=True,
                ),
            )
            stages.append({
                "stage": "parse_answers",
                "status": "skipped",
                "detail": "skip_parse=True",
            })
        else:
            stages.append(await self._run_parse_stage(run_id))

        # ----------------------------------------------------------------
        # Stage 3: Score Run (optional -- skip or fail gracefully)
        # ----------------------------------------------------------------
        if input.skip_score:
            await self._update_stage_state(
                run_id,
                UpdateStatusInput(
                    run_id=run_id,
                    score_status="skipped",
                    set_score_completed=True,
                    set_completed=True,
                ),
            )
            stages.append({
                "stage": "score_run",
                "status": "skipped",
                "detail": "skip_score=True",
            })
        else:
            stages.append(await self._run_score_stage(run_id))

        # ----------------------------------------------------------------
        # Determine overall status
        # ----------------------------------------------------------------
        stage_statuses = {s["status"] for s in stages}
        if "failed" in stage_statuses:
            overall = "partial"
        else:
            overall = "completed"

        workflow.logger.info(
            "Pipeline for run %s finished: %s (%d stages)",
            run_id,
            overall,
            len(stages),
        )

        if overall in {"completed", "partial"}:
            try:
                await workflow.execute_activity(
                    dispatch_run_completed_event_activity,
                    run_id,
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
            except Exception as exc:
                workflow.logger.warning(
                    "Failed to dispatch run completion integration event for run %s: %s",
                    run_id,
                    exc,
                )

        return PipelineResult(
            run_id=run_id,
            status=overall,
            stages=stages,
        )

    async def _run_parse_stage(self, run_id: str) -> dict:
        await self._update_stage_state(
            run_id,
            UpdateStatusInput(
                run_id=run_id,
                parse_status="running",
                set_parse_started=True,
            ),
        )
        try:
            result: ParseResult = await workflow.execute_child_workflow(
                "ParseAnswersWorkflow",
                ParseInput(run_id=run_id),
                id=f"parse-answers-{run_id}",
                task_queue="aeogeo-pipeline",
                execution_timeout=timedelta(hours=1),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception as exc:
            error_msg = str(exc)
            workflow.logger.warning(
                "ParseAnswersWorkflow failed: %s", error_msg
            )
            await self._update_stage_state(
                run_id,
                UpdateStatusInput(
                    run_id=run_id,
                    parse_status="failed",
                    error_message=f"parse: {error_msg}",
                    set_parse_completed=True,
                    set_completed=True,
                ),
            )
            return {
                "stage": "parse_answers",
                "status": "failed",
                "detail": error_msg,
            }

        if isinstance(result, dict):
            result = ParseResult(**result)

        stage_status = "partial" if result.errors else "completed"
        await self._update_stage_state(
            run_id,
            UpdateStatusInput(
                run_id=run_id,
                parse_status=stage_status,
                parse_completed=result.parsed + result.skipped,
                error_message=f"parse: {result.errors} answers failed" if result.errors else None,
                set_parse_completed=True,
            ),
        )
        return {
            "stage": "parse_answers",
            "status": stage_status,
            "detail": (
                f"parsed={result.parsed}, skipped={result.skipped}, "
                f"cached={result.cached}, errors={result.errors}"
            ),
        }

    async def _run_score_stage(self, run_id: str) -> dict:
        await self._update_stage_state(
            run_id,
            UpdateStatusInput(
                run_id=run_id,
                score_status="running",
                set_score_started=True,
            ),
        )
        try:
            result: ScoreResult = await workflow.execute_child_workflow(
                "ScoreRunWorkflow",
                ScoreInput(run_id=run_id),
                id=f"score-run-{run_id}",
                task_queue="aeogeo-pipeline",
                execution_timeout=timedelta(hours=1),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception as exc:
            error_msg = str(exc)
            workflow.logger.warning("ScoreRunWorkflow failed: %s", error_msg)
            await self._update_stage_state(
                run_id,
                UpdateStatusInput(
                    run_id=run_id,
                    score_status="failed",
                    error_message=f"score: {error_msg}",
                    set_score_completed=True,
                    set_completed=True,
                ),
            )
            return {
                "stage": "score_run",
                "status": "failed",
                "detail": error_msg,
            }

        if isinstance(result, dict):
            result = ScoreResult(**result)

        await self._update_stage_state(
            run_id,
            UpdateStatusInput(
                run_id=run_id,
                score_status=result.status,
                score_completed=result.total_scored,
                error_message=f"score: {result.errors} answers failed" if result.errors else None,
                set_score_completed=True,
                set_completed=True,
            ),
        )
        return {
            "stage": "score_run",
            "status": result.status,
            "detail": (
                f"scored={result.total_scored}/{result.eligible_answers}, "
                f"errors={result.errors}, avg_total={result.avg_total_score}"
            ),
        }

    @staticmethod
    async def _update_stage_state(
        run_id: str,
        input: UpdateStatusInput,
    ) -> None:
        try:
            await workflow.execute_activity(
                update_run_status_activity,
                input,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except Exception as exc:
            workflow.logger.warning(
                "Failed to update pipeline state for run %s: %s",
                run_id,
                exc,
            )
