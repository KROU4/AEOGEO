"""Workflow: Parse raw AI engine answers into structured data.

Takes a run_id and processes all its answers through the ParseRunnerService,
extracting brand mentions, citations, recommendations, and sentiment signals.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

TASK_QUEUE = "aeogeo-pipeline"


@dataclass
class ParseInput:
    """Input for the ParseAnswersWorkflow and its activity."""

    run_id: str  # UUID as string (Temporal requires serializable types)
    batch_size: int = 20


@dataclass
class ParseResult:
    """Result summary from parsing a run's answers."""

    total_answers: int
    parsed: int
    cached: int
    skipped: int
    errors: int


@activity.defn
async def parse_run_answers_activity(input: ParseInput) -> ParseResult:
    """Activity: parse all answers for an engine run.

    Creates a DB session and Redis connection, instantiates ParseRunnerService,
    and processes all answers for the given run_id.
    """
    import uuid

    from redis.asyncio import Redis

    from app.config import get_settings
    from app.dependencies import async_session
    from app.services.ai_key import AIKeyService
    from app.services.parse_runner import ParseRunnerService

    settings = get_settings()

    async with async_session() as db:
        key_service = AIKeyService(db)
        # Parse uses OpenAI-style API; allow OPENAI_API_KEY or OPENROUTER_API_KEY.
        base_url = "https://api.openai.com/v1/chat/completions"
        api_key, used_openrouter = key_service.resolve_key_meta("openai")
        if api_key and used_openrouter:
            base_url = "https://openrouter.ai/api/v1/chat/completions"

        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            service = ParseRunnerService(
                db=db, redis=redis, api_key=api_key, base_url=base_url,
            )
            result = await service.parse_run_answers(
                run_id=uuid.UUID(input.run_id),
                batch_size=input.batch_size,
            )
            return ParseResult(
                total_answers=result["total_answers"],
                parsed=result["parsed"],
                cached=result["cached"],
                skipped=result["skipped"],
                errors=result["errors"],
            )
        finally:
            await redis.aclose()


@workflow.defn
class ParseAnswersWorkflow:
    """Parse and structure raw AI engine responses for a run.

    Input:  ParseInput with run_id and optional batch_size
    Output: ParseResult with counts of parsed/cached/errored answers

    Steps:
    1. Execute parse_run_answers_activity with the given run_id
    2. The activity loads all Answers for the run, checks Redis cache,
       calls LLM for uncached answers, and creates Mention/Citation records
    3. Return the summary result
    """

    @workflow.run
    async def run(self, input: ParseInput) -> ParseResult:
        result = await workflow.execute_activity(
            parse_run_answers_activity,
            input,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        return result
