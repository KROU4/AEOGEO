"""Scores router — visibility score aggregations for a project."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.models.project import Project
from app.models.query import Query as QueryModel
from app.models.user import User
from app.schemas.visibility_score import (
    RunComparisonResponse,
    RunSummaryResponse,
    ScoreByEngineResponse,
    ScoreByQueryResponse,
    ScoreTrendEntry,
)
from app.services.scoring import ScoringService

router = APIRouter(
    prefix="/projects/{project_id}/scores",
    tags=["scores"],
)


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


async def _latest_completed_run(
    project_id: UUID,
    db: AsyncSession,
) -> EngineRun:
    """Return the most recent completed run, or 404."""
    result = await db.execute(
        select(EngineRun)
        .where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
        )
        .order_by(EngineRun.created_at.desc())
        .limit(1)
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(
            status_code=404,
            detail="No completed runs found for this project",
        )
    return run


async def _get_run_for_project(
    run_id: UUID,
    project_id: UUID,
    db: AsyncSession,
) -> EngineRun:
    """Return a specific run belonging to the project, or 404."""
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


# ---------------------------------------------------------------------------
# GET /projects/{pid}/scores/summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=RunSummaryResponse)
async def get_summary(
    project_id: UUID,
    run_id: UUID | None = Query(default=None, description="Specific run ID; defaults to latest completed"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RunSummaryResponse:
    """Latest run aggregated scores (or a specific run if run_id provided)."""
    await _verify_project(project_id, user.tenant_id, db)

    if run_id is not None:
        run = await _get_run_for_project(run_id, project_id, db)
    else:
        run = await _latest_completed_run(project_id, db)

    svc = ScoringService(db)
    data = await svc.get_run_summary(run.id)

    return RunSummaryResponse(
        run_id=run.id,
        score_count=data["score_count"],
        avg_total=data["avg_total"],
        avg_mention=data["avg_mention"],
        avg_sentiment=data["avg_sentiment"],
        avg_position=data["avg_position"],
        avg_accuracy=data["avg_accuracy"],
        avg_citation=data["avg_citation"],
        avg_recommendation=data["avg_recommendation"],
        min_total=data["min_total"],
        max_total=data["max_total"],
    )


# ---------------------------------------------------------------------------
# GET /projects/{pid}/scores/by-query
# ---------------------------------------------------------------------------

@router.get("/by-query", response_model=list[ScoreByQueryResponse])
async def get_scores_by_query(
    project_id: UUID,
    run_id: UUID | None = Query(default=None, description="Specific run ID; defaults to latest completed"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ScoreByQueryResponse]:
    """Scores grouped by query for a run (paginated)."""
    await _verify_project(project_id, user.tenant_id, db)

    if run_id is not None:
        run = await _get_run_for_project(run_id, project_id, db)
    else:
        run = await _latest_completed_run(project_id, db)

    svc = ScoringService(db)
    rows = await svc.get_scores_by_query(run.id)

    # Enrich with query text
    query_ids = [UUID(r["query_id"]) for r in rows]
    if query_ids:
        q_result = await db.execute(
            select(QueryModel.id, QueryModel.text).where(
                QueryModel.id.in_(query_ids),
            )
        )
        text_map = {row.id: row.text for row in q_result.all()}
    else:
        text_map = {}

    # Apply pagination
    paginated = rows[offset : offset + limit]

    return [
        ScoreByQueryResponse(
            query_id=UUID(r["query_id"]),
            query_text=text_map.get(UUID(r["query_id"])),
            score_count=r["score_count"],
            avg_total=r["avg_total"],
            avg_mention=r["avg_mention"],
            avg_sentiment=r["avg_sentiment"],
            avg_position=r["avg_position"],
            avg_accuracy=r["avg_accuracy"],
            avg_citation=r["avg_citation"],
            avg_recommendation=r["avg_recommendation"],
        )
        for r in paginated
    ]


# ---------------------------------------------------------------------------
# GET /projects/{pid}/scores/by-engine
# ---------------------------------------------------------------------------

@router.get("/by-engine", response_model=list[ScoreByEngineResponse])
async def get_scores_by_engine(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ScoreByEngineResponse]:
    """Scores grouped by engine for a project (across all runs)."""
    await _verify_project(project_id, user.tenant_id, db)

    svc = ScoringService(db)
    rows = await svc.get_scores_by_engine(project_id)

    # Enrich with engine names
    engine_ids = [UUID(r["engine_id"]) for r in rows]
    if engine_ids:
        e_result = await db.execute(
            select(Engine.id, Engine.name).where(Engine.id.in_(engine_ids))
        )
        name_map = {row.id: row.name for row in e_result.all()}
    else:
        name_map = {}

    return [
        ScoreByEngineResponse(
            engine_id=UUID(r["engine_id"]),
            engine_name=name_map.get(UUID(r["engine_id"])),
            score_count=r["score_count"],
            avg_total=r["avg_total"],
            avg_mention=r["avg_mention"],
            avg_sentiment=r["avg_sentiment"],
            avg_position=r["avg_position"],
            avg_accuracy=r["avg_accuracy"],
            avg_citation=r["avg_citation"],
            avg_recommendation=r["avg_recommendation"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /projects/{pid}/scores/trends
# ---------------------------------------------------------------------------

@router.get("/trends", response_model=list[ScoreTrendEntry])
async def get_score_trends(
    project_id: UUID,
    limit: int = Query(default=10, ge=1, le=50, alias="n"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ScoreTrendEntry]:
    """Score trends over the last N completed runs."""
    await _verify_project(project_id, user.tenant_id, db)

    svc = ScoringService(db)
    rows = await svc.get_score_trends(project_id, limit=limit)

    return [
        ScoreTrendEntry(
            run_id=UUID(r["run_id"]),
            created_at=r["created_at"],
            score_count=r["score_count"],
            avg_total=r["avg_total"],
            avg_mention=r["avg_mention"],
            avg_sentiment=r["avg_sentiment"],
            avg_position=r["avg_position"],
            avg_accuracy=r["avg_accuracy"],
            avg_citation=r["avg_citation"],
            avg_recommendation=r["avg_recommendation"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /projects/{pid}/scores/comparison
# ---------------------------------------------------------------------------

@router.get("/comparison", response_model=RunComparisonResponse)
async def compare_runs(
    project_id: UUID,
    run_a: UUID = Query(..., description="First run ID"),
    run_b: UUID = Query(..., description="Second run ID"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RunComparisonResponse:
    """Compare two runs side-by-side."""
    await _verify_project(project_id, user.tenant_id, db)

    # Verify both runs belong to this project
    run_a_obj = await _get_run_for_project(run_a, project_id, db)
    run_b_obj = await _get_run_for_project(run_b, project_id, db)

    svc = ScoringService(db)
    summary_a = await svc.get_run_summary(run_a_obj.id)
    summary_b = await svc.get_run_summary(run_b_obj.id)

    return RunComparisonResponse(
        run_a=RunSummaryResponse(
            run_id=run_a_obj.id,
            score_count=summary_a["score_count"],
            avg_total=summary_a["avg_total"],
            avg_mention=summary_a["avg_mention"],
            avg_sentiment=summary_a["avg_sentiment"],
            avg_position=summary_a["avg_position"],
            avg_accuracy=summary_a["avg_accuracy"],
            avg_citation=summary_a["avg_citation"],
            avg_recommendation=summary_a["avg_recommendation"],
            min_total=summary_a["min_total"],
            max_total=summary_a["max_total"],
        ),
        run_b=RunSummaryResponse(
            run_id=run_b_obj.id,
            score_count=summary_b["score_count"],
            avg_total=summary_b["avg_total"],
            avg_mention=summary_b["avg_mention"],
            avg_sentiment=summary_b["avg_sentiment"],
            avg_position=summary_b["avg_position"],
            avg_accuracy=summary_b["avg_accuracy"],
            avg_citation=summary_b["avg_citation"],
            avg_recommendation=summary_b["avg_recommendation"],
            min_total=summary_b["min_total"],
            max_total=summary_b["max_total"],
        ),
    )
