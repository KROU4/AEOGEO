"""Dashboard router — real aggregated metrics from pipeline data."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.answer import Answer
from app.models.citation import Citation
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.project import Project
from app.models.user import User
from app.models.visibility_score import VisibilityScore
from app.schemas.dashboard import (
    ActivityItem,
    CitationRate,
    SentimentBreakdown,
    ShareOfVoiceEntry,
    VisibilityScore as VisibilityScoreSchema,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _verify_project_access(
    project_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Project:
    """Return the project if it belongs to the user's tenant, else 404."""
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
) -> EngineRun | None:
    """Return the most recent completed EngineRun for a project."""
    result = await db.execute(
        select(EngineRun)
        .where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
        )
        .order_by(EngineRun.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _previous_completed_run(
    project_id: UUID,
    exclude_run_id: UUID,
    db: AsyncSession,
) -> EngineRun | None:
    """Return the second-most-recent completed run (for trend calculation)."""
    result = await db.execute(
        select(EngineRun)
        .where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
            EngineRun.id != exclude_run_id,
        )
        .order_by(EngineRun.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _run_ids_for_project(
    project_id: UUID,
    db: AsyncSession,
) -> list[UUID]:
    """Return all run IDs for a project."""
    result = await db.execute(
        select(EngineRun.id).where(EngineRun.project_id == project_id)
    )
    return [row[0] for row in result.all()]


# ---------------------------------------------------------------------------
# GET /dashboard/visibility-score
# ---------------------------------------------------------------------------

@router.get("/visibility-score", response_model=VisibilityScoreSchema)
async def visibility_score(
    project_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> VisibilityScoreSchema:
    await _verify_project_access(project_id, user.tenant_id, db)

    latest_run = await _latest_completed_run(project_id, db)
    if latest_run is None:
        return VisibilityScoreSchema(score=0, trend=None, period="latest")

    # Average total_score from the latest run
    result = await db.execute(
        select(func.avg(VisibilityScore.total_score)).where(
            VisibilityScore.run_id == latest_run.id,
        )
    )
    avg_score = result.scalar()
    current_avg = round(float(avg_score), 2) if avg_score is not None else 0.0

    # Compute trend (delta) from the previous completed run
    trend: float | None = None
    prev_run = await _previous_completed_run(project_id, latest_run.id, db)
    if prev_run is not None:
        prev_result = await db.execute(
            select(func.avg(VisibilityScore.total_score)).where(
                VisibilityScore.run_id == prev_run.id,
            )
        )
        prev_avg = prev_result.scalar()
        if prev_avg is not None:
            trend = round(current_avg - float(prev_avg), 2)

    return VisibilityScoreSchema(score=current_avg, trend=trend, period="latest")


# ---------------------------------------------------------------------------
# GET /dashboard/share-of-voice
# ---------------------------------------------------------------------------

@router.get("/share-of-voice", response_model=list[ShareOfVoiceEntry])
async def share_of_voice(
    project_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ShareOfVoiceEntry]:
    await _verify_project_access(project_id, user.tenant_id, db)

    run_ids = await _run_ids_for_project(project_id, db)
    if not run_ids:
        return []

    # Count Mentions where is_recommended=True, grouped by engine
    # Mentions -> Answer -> EngineRun (filter by project runs)
    result = await db.execute(
        select(
            Answer.engine_id,
            Engine.name.label("engine_name"),
            func.count().label("rec_count"),
        )
        .join(Answer, Mention.answer_id == Answer.id)
        .join(Engine, Answer.engine_id == Engine.id)
        .where(
            Answer.run_id.in_(run_ids),
            Mention.is_recommended.is_(True),
        )
        .group_by(Answer.engine_id, Engine.name)
    )
    rows = result.all()

    total_recs = sum(row.rec_count for row in rows)
    if total_recs == 0:
        return []

    return [
        ShareOfVoiceEntry(
            engine=row.engine_name,
            engine_id=str(row.engine_id),
            share=round(row.rec_count / total_recs * 100, 1),
            mention_count=row.rec_count,
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# GET /dashboard/sentiment
# ---------------------------------------------------------------------------

@router.get("/sentiment", response_model=SentimentBreakdown)
async def sentiment(
    project_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SentimentBreakdown:
    await _verify_project_access(project_id, user.tenant_id, db)

    run_ids = await _run_ids_for_project(project_id, db)
    if not run_ids:
        return SentimentBreakdown(
            positive=0, neutral=0, negative=0,
            positive_pct=0, neutral_pct=0, negative_pct=0,
        )

    # Count Mentions grouped by sentiment
    result = await db.execute(
        select(
            func.count().filter(Mention.sentiment == "positive").label("positive"),
            func.count().filter(Mention.sentiment == "neutral").label("neutral"),
            func.count().filter(Mention.sentiment == "negative").label("negative"),
        )
        .join(Answer, Mention.answer_id == Answer.id)
        .where(Answer.run_id.in_(run_ids))
    )
    row = result.one()

    pos = row.positive or 0
    neu = row.neutral or 0
    neg = row.negative or 0
    total = pos + neu + neg

    if total == 0:
        return SentimentBreakdown(
            positive=0, neutral=0, negative=0,
            positive_pct=0, neutral_pct=0, negative_pct=0,
        )

    return SentimentBreakdown(
        positive=pos,
        neutral=neu,
        negative=neg,
        positive_pct=round(pos / total * 100, 1),
        neutral_pct=round(neu / total * 100, 1),
        negative_pct=round(neg / total * 100, 1),
    )


# ---------------------------------------------------------------------------
# GET /dashboard/citation-rate
# ---------------------------------------------------------------------------

@router.get("/citation-rate", response_model=CitationRate)
async def citation_rate(
    project_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CitationRate:
    await _verify_project_access(project_id, user.tenant_id, db)

    run_ids = await _run_ids_for_project(project_id, db)
    if not run_ids:
        return CitationRate(rate=0, total_citations=0, total_answers=0, period="all")

    # Total answers for this project
    total_answers_result = await db.execute(
        select(func.count()).select_from(Answer).where(
            Answer.run_id.in_(run_ids),
        )
    )
    total_answers: int = total_answers_result.scalar() or 0

    if total_answers == 0:
        return CitationRate(rate=0, total_citations=0, total_answers=0, period="all")

    # Count total citations
    total_citations_result = await db.execute(
        select(func.count()).select_from(Citation)
        .join(Answer, Citation.answer_id == Answer.id)
        .where(Answer.run_id.in_(run_ids))
    )
    total_citations: int = total_citations_result.scalar() or 0

    # Count answers that have at least one citation
    answers_with_citation_result = await db.execute(
        select(func.count(func.distinct(Citation.answer_id)))
        .join(Answer, Citation.answer_id == Answer.id)
        .where(Answer.run_id.in_(run_ids))
    )
    answers_with_citation: int = answers_with_citation_result.scalar() or 0

    rate = round(answers_with_citation / total_answers, 4) if total_answers > 0 else 0.0

    return CitationRate(
        rate=rate,
        total_citations=total_citations,
        total_answers=total_answers,
        period="all",
    )


# ---------------------------------------------------------------------------
# GET /dashboard/recent-activity
# ---------------------------------------------------------------------------

@router.get("/recent-activity", response_model=list[ActivityItem])
async def recent_activity(
    project_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ActivityItem]:
    await _verify_project_access(project_id, user.tenant_id, db)

    activities: list[ActivityItem] = []

    # 1. Latest EngineRuns (status changes)
    runs_result = await db.execute(
        select(EngineRun)
        .where(EngineRun.project_id == project_id)
        .order_by(EngineRun.created_at.desc())
        .limit(5)
    )
    for run in runs_result.scalars().all():
        ts = run.completed_at or run.started_at or run.created_at
        activities.append(ActivityItem(
            id=str(run.id),
            type="engine_run",
            description=f"Engine run {run.status}",
            timestamp=ts.isoformat() if ts else "",
        ))

    # Sort all by timestamp descending, limit to 10
    activities.sort(key=lambda a: a.timestamp, reverse=True)
    return activities[:10]
