"""Run management router — trigger, list, and inspect engine runs."""

import asyncio
import json
import logging
import os
from collections.abc import AsyncGenerator
from datetime import UTC
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import async_session, get_current_user, get_db
from app.models.answer import Answer
from app.models.engine_run import EngineRun
from app.models.project import Project
from app.models.query import Query as QueryModel
from app.models.user import User
from app.schemas.answer import AnswerDetail, AnswerResponse
from app.schemas.engine_run import (
    BatchRunStreamRequest,
    EngineRunCreate,
    EngineRunProgress,
    EngineRunResponse,
    LatestRunStatusResponse,
)
from app.schemas.visibility_score import VisibilityScoreResponse
from app.services.engine_runner import EngineRunnerService
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    paginate_results,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/runs", tags=["runs"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _verify_project(
    project_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Project:
    """Return the project or raise 404."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.tenant_id == tenant_id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_run(
    run_id: UUID,
    project_id: UUID,
    db: AsyncSession,
) -> EngineRun:
    """Return the engine run or raise 404."""
    result = await db.execute(
        select(EngineRun).where(
            EngineRun.id == run_id,
            EngineRun.project_id == project_id,
        )
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


async def _start_pipeline_workflow(run_id: UUID, *, retry: bool = False) -> None:
    from temporalio.client import Client as TemporalClient

    temporal_host = os.getenv("TEMPORAL_HOST", "temporal:7233")
    temporal_client = await TemporalClient.connect(temporal_host)
    workflow_id = f"pipeline-{run_id}"
    if retry:
        workflow_id = f"{workflow_id}-retry-{uuid4()}"

    await temporal_client.start_workflow(
        "FullPipelineWorkflow",
        {"engine_run_id": str(run_id)},
        id=workflow_id,
        task_queue="aeogeo-pipeline",
    )


# ---------------------------------------------------------------------------
# POST /projects/{project_id}/runs  — trigger engine run
# ---------------------------------------------------------------------------

@router.post("", response_model=EngineRunResponse, status_code=201)
async def trigger_run(
    project_id: UUID,
    body: EngineRunCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineRunResponse:
    await _verify_project(project_id, user.tenant_id, db)

    run = EngineRun(
        status="pending",
        sample_count=body.sample_count,
        triggered_by="manual",
        query_set_id=body.query_set_id,
        engine_id=body.engine_id,
        project_id=project_id,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    # Start Temporal workflow (best-effort — if Temporal is unavailable the
    # run record still exists with status=pending so it can be retried).
    try:
        await _start_pipeline_workflow(run.id)
    except Exception:
        logger.warning(
            "Failed to start Temporal workflow for run %s — "
            "run saved with status=pending",
            run.id,
            exc_info=True,
        )

    await db.commit()
    await db.refresh(run)

    return EngineRunResponse.model_validate(run)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/runs  — list runs
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedResponse[EngineRunResponse])
async def list_runs(
    project_id: UUID,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    engine_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[EngineRunResponse]:
    await _verify_project(project_id, user.tenant_id, db)

    query = select(EngineRun).where(EngineRun.project_id == project_id)

    if status:
        query = query.where(EngineRun.status == status)
    if engine_id:
        query = query.where(EngineRun.engine_id == engine_id)

    query = apply_cursor_pagination(query, EngineRun, cursor, limit)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    items, next_cursor, has_more = paginate_results(rows, limit)
    return PaginatedResponse(
        items=[EngineRunResponse.model_validate(r) for r in items],
        next_cursor=next_cursor,
        has_more=has_more,
    )


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/runs/latest  — most recent run (any status)
# ---------------------------------------------------------------------------

@router.get("/latest", response_model=LatestRunStatusResponse)
async def get_latest_run(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LatestRunStatusResponse:
    await _verify_project(project_id, user.tenant_id, db)
    result = await db.execute(
        select(EngineRun)
        .where(EngineRun.project_id == project_id)
        .order_by(EngineRun.created_at.desc())
        .limit(1),
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="No runs for this project")

    expected = max(run.answers_expected or 0, 1)
    progress_pct = int(min(100, round(100 * (run.answers_completed / expected))))

    updated = run.updated_at or run.completed_at or run.created_at
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=UTC)

    return LatestRunStatusResponse(
        run_id=run.id,
        status=run.status,
        completed_at=run.completed_at,
        stages={
            "engine": run.engine_status,
            "parse": run.parse_status,
            "score": run.score_status,
        },
        progress_pct=progress_pct,
        updated_at=updated,
    )


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/runs/{run_id}  — run detail
# ---------------------------------------------------------------------------

@router.get("/{run_id}", response_model=EngineRunResponse)
async def get_run(
    project_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineRunResponse:
    await _verify_project(project_id, user.tenant_id, db)
    run = await _get_run(run_id, project_id, db)
    return EngineRunResponse.model_validate(run)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/runs/{run_id}/progress  — run progress
# ---------------------------------------------------------------------------

@router.get("/{run_id}/progress", response_model=EngineRunProgress)
async def get_run_progress(
    project_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineRunProgress:
    await _verify_project(project_id, user.tenant_id, db)
    run = await _get_run(run_id, project_id, db)

    # Total queries = number of approved queries in the query set
    total_queries_result = await db.execute(
        select(func.count()).select_from(QueryModel).where(
            QueryModel.query_set_id == run.query_set_id,
            QueryModel.status == "approved",
        )
    )
    total_queries: int = total_queries_result.scalar() or 0

    persisted_answers_result = await db.execute(
        select(func.count()).select_from(Answer).where(
            Answer.run_id == run.id,
        )
    )
    persisted_answers: int = persisted_answers_result.scalar() or 0

    parsed_answers_result = await db.execute(
        select(func.count()).select_from(Answer).where(
            Answer.run_id == run.id,
            Answer.parse_status == "completed",
        )
    )
    parsed_answers: int = parsed_answers_result.scalar() or 0

    return EngineRunProgress(
        id=run.id,
        status=run.status,
        engine_status=run.engine_status,
        parse_status=run.parse_status,
        score_status=run.score_status,
        error_message=run.error_message,
        engine={
            "status": run.engine_status,
            "total": run.answers_expected or (total_queries * run.sample_count),
            "completed": run.answers_completed,
        },
        parse={
            "status": run.parse_status,
            "total": persisted_answers,
            "completed": run.parse_completed,
        },
        score={
            "status": run.score_status,
            "total": parsed_answers,
            "completed": run.score_completed,
        },
    )


# ---------------------------------------------------------------------------
# POST /projects/{project_id}/runs/stream/progress  — SSE progress stream
# ---------------------------------------------------------------------------

_TERMINAL_STATUSES = {"completed", "failed", "partial", "cancelled"}


def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _get_run_or_none(
    run_id: UUID, project_id: UUID, db: AsyncSession,
) -> EngineRun | None:
    result = await db.execute(
        select(EngineRun).where(
            EngineRun.id == run_id,
            EngineRun.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def _build_progress_snapshot(
    run: EngineRun, db: AsyncSession,
) -> dict:
    """Build a progress dict for a single run."""
    total_queries: int = (
        await db.execute(
            select(func.count()).select_from(QueryModel).where(
                QueryModel.query_set_id == run.query_set_id,
                QueryModel.status == "approved",
            )
        )
    ).scalar() or 0

    persisted_answers: int = (
        await db.execute(
            select(func.count()).select_from(Answer).where(
                Answer.run_id == run.id,
            )
        )
    ).scalar() or 0

    parsed_answers: int = (
        await db.execute(
            select(func.count()).select_from(Answer).where(
                Answer.run_id == run.id,
                Answer.parse_status == "completed",
            )
        )
    ).scalar() or 0

    return {
        "run_id": str(run.id),
        "status": run.status,
        "error_message": run.error_message,
        "engine": {
            "status": run.engine_status,
            "total": run.answers_expected
            or (total_queries * run.sample_count),
            "completed": run.answers_completed,
        },
        "parse": {
            "status": run.parse_status,
            "total": persisted_answers,
            "completed": run.parse_completed,
        },
        "score": {
            "status": run.score_status,
            "total": parsed_answers,
            "completed": run.score_completed,
        },
    }


@router.post("/stream/progress")
async def stream_runs_progress(
    project_id: UUID,
    body: BatchRunStreamRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Stream progress for multiple runs via SSE."""
    await _verify_project(project_id, user.tenant_id, db)
    run_ids = body.run_ids

    async def event_generator() -> AsyncGenerator[str, None]:
        prev: dict[str, dict] = {}
        deadline = asyncio.get_event_loop().time() + 600  # 10 min

        yield _sse_event("stream_start", {
            "run_ids": [str(r) for r in run_ids],
        })

        while asyncio.get_event_loop().time() < deadline:
            async with async_session() as poll_db:
                all_terminal = True
                for rid in run_ids:
                    run = await _get_run_or_none(rid, project_id, poll_db)
                    if run is None:
                        continue
                    snap = await _build_progress_snapshot(run, poll_db)
                    key = str(rid)
                    if snap != prev.get(key):
                        prev[key] = snap
                        yield _sse_event("run_update", snap)
                    if snap["status"] not in _TERMINAL_STATUSES:
                        all_terminal = False

            if all_terminal and prev:
                yield _sse_event("all_complete", {
                    "run_ids": [str(r) for r in run_ids],
                })
                return

            await asyncio.sleep(1.5)

        yield _sse_event("timeout", {"message": "Stream timed out"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/{run_id}/retry", response_model=EngineRunResponse)
async def retry_run(
    project_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineRunResponse:
    await _verify_project(project_id, user.tenant_id, db)
    run = await _get_run(run_id, project_id, db)

    if run.status == "completed":
        raise HTTPException(
            status_code=409,
            detail="Completed runs cannot be retried — use New Run instead",
        )

    # Best-effort cancel of any active Temporal workflow for running/pending runs
    if run.status in {"running", "pending"}:
        try:
            from temporalio.client import Client as TemporalClient

            temporal_address = os.getenv("TEMPORAL_ADDRESS", "temporal:7233")
            client = await TemporalClient.connect(temporal_address)
            handle = client.get_workflow_handle(f"pipeline-{run_id}")
            await handle.cancel()
        except Exception:
            logger.warning(
                "Failed to cancel Temporal workflow for run %s before retry",
                run_id,
                exc_info=True,
            )

    service = EngineRunnerService(db)
    reset_run = await service.reset_run_for_retry(run_id)
    if reset_run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    try:
        await _start_pipeline_workflow(run_id, retry=True)
    except Exception as exc:
        logger.warning(
            "Failed to start retry workflow for run %s",
            run_id,
            exc_info=True,
        )
        await db.commit()
        await db.refresh(reset_run)
        raise HTTPException(
            status_code=503,
            detail=f"Retry reset the run, but Temporal start failed: {exc}",
        ) from exc

    await db.commit()
    await db.refresh(reset_run)
    return EngineRunResponse.model_validate(reset_run)


@router.post("/{run_id}/cancel", response_model=EngineRunResponse)
async def cancel_run(
    project_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineRunResponse:
    await _verify_project(project_id, user.tenant_id, db)
    run = await _get_run(run_id, project_id, db)

    if run.status not in {"pending", "running"}:
        raise HTTPException(
            status_code=409,
            detail="Only pending or running runs can be cancelled",
        )

    run.status = "cancelled"
    await db.commit()
    await db.refresh(run)

    # Best-effort Temporal workflow cancellation
    try:
        from temporalio.client import Client as TemporalClient

        temporal_address = os.getenv("TEMPORAL_ADDRESS", "temporal:7233")
        client = await TemporalClient.connect(temporal_address)
        handle = client.get_workflow_handle(f"pipeline-{run_id}")
        await handle.cancel()
    except Exception:
        logger.warning(
            "Failed to cancel Temporal workflow for run %s",
            run_id,
            exc_info=True,
        )

    return EngineRunResponse.model_validate(run)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/runs/{run_id}/answers  — list answers
# ---------------------------------------------------------------------------

@router.get(
    "/{run_id}/answers",
    response_model=PaginatedResponse[AnswerResponse],
)
async def list_answers(
    project_id: UUID,
    run_id: UUID,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    query_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[AnswerResponse]:
    await _verify_project(project_id, user.tenant_id, db)
    await _get_run(run_id, project_id, db)

    query = select(Answer).where(Answer.run_id == run_id)

    if query_id:
        query = query.where(Answer.query_id == query_id)

    query = apply_cursor_pagination(query, Answer, cursor, limit)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    items, next_cursor, has_more = paginate_results(rows, limit)
    return PaginatedResponse(
        items=[AnswerResponse.model_validate(a) for a in items],
        next_cursor=next_cursor,
        has_more=has_more,
    )


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/runs/{run_id}/answers/{answer_id}  — answer detail
# ---------------------------------------------------------------------------

@router.get(
    "/{run_id}/answers/{answer_id}",
    response_model=AnswerDetail,
)
async def get_answer_detail(
    project_id: UUID,
    run_id: UUID,
    answer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnswerDetail:
    await _verify_project(project_id, user.tenant_id, db)
    await _get_run(run_id, project_id, db)

    result = await db.execute(
        select(Answer)
        .where(Answer.id == answer_id, Answer.run_id == run_id)
        .options(
            selectinload(Answer.mentions),
            selectinload(Answer.citations),
            selectinload(Answer.visibility_score),
        )
    )
    answer = result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(status_code=404, detail="Answer not found")

    return AnswerDetail(
        id=answer.id,
        sample_index=answer.sample_index,
        raw_response=answer.raw_response,
        query_text=answer.query_text,
        engine_name=answer.engine_name,
        engine_provider=answer.engine_provider,
        response_metadata=answer.response_metadata,
        parse_status=answer.parse_status,
        parse_error=answer.parse_error,
        score_status=answer.score_status,
        score_error=answer.score_error,
        run_id=answer.run_id,
        query_id=answer.query_id,
        engine_id=answer.engine_id,
        created_at=answer.created_at,
        mentions=[m for m in answer.mentions],
        citations=[c for c in answer.citations],
        score=(
            VisibilityScoreResponse.model_validate(answer.visibility_score)
            if answer.visibility_score
            else None
        ),
    )
