"""Workflow: Score a completed pipeline run.

Aggregates parsed answers from all engines and queries into
per-query, per-engine, and overall visibility scores.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.workflows.activities import score_run_activity


@dataclass
class ScoreInput:
    """Input for the ScoreRunWorkflow."""

    run_id: str


@dataclass
class ScoreResult:
    """Result of scoring a pipeline run."""

    total_scored: int = 0
    eligible_answers: int = 0
    avg_total_score: float = 0.0
    errors: int = 0
    status: str = "completed"
    error: str | None = None


@workflow.defn
class ScoreRunWorkflow:
    """Compute visibility scores for a pipeline run.

    Input:  ScoreInput with run_id identifying the completed run
    Output: ScoreResult with scoring summary

    Steps:
    1. Execute score_run_activity which loads all unscored answers,
       computes 6-dimension sub-scores for each, and persists VisibilityScore records
    2. Return scoring summary with count and average
    """

    @workflow.run
    async def run(self, input: ScoreInput) -> ScoreResult:
        workflow.logger.info("Starting scoring for run=%s", input.run_id)

        try:
            result = await workflow.execute_activity(
                score_run_activity,
                input.run_id,
                start_to_close_timeout=timedelta(minutes=15),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=2),
                    maximum_attempts=3,
                    backoff_coefficient=2.0,
                ),
            )
        except Exception as e:
            workflow.logger.error("Score run activity failed: %s", e)
            return ScoreResult(
                status="failed",
                error=f"Scoring failed: {e}",
            )

        total_scored = result.get("total_scored", 0)
        eligible_answers = result.get("eligible_answers", 0)
        avg_total_score = result.get("avg_total_score", 0.0)
        errors = result.get("errors", 0)

        workflow.logger.info(
            "Scoring completed for run=%s: %d/%d answers scored, avg=%.2f, errors=%d",
            input.run_id,
            total_scored,
            eligible_answers,
            avg_total_score,
            errors,
        )

        return ScoreResult(
            total_scored=total_scored,
            eligible_answers=eligible_answers,
            avg_total_score=avg_total_score,
            errors=errors,
            status="partial" if errors else "completed",
        )
