"""Build `/projects/{id}/dashboard` + platform table from DB aggregates."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.brand import Brand
from app.models.citation import Citation
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.visibility_score import VisibilityScore
from app.schemas.project_dashboard_contract import (
    DashboardPlatformRow,
    DashboardPlatformsResponse,
    ProjectDashboardResponse,
)


def _period_start(period: str) -> datetime:
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
    return datetime.now(UTC) - timedelta(days=days)


async def _completed_runs_in_window(
    db: AsyncSession,
    project_id: UUID,
    since: datetime,
    *,
    desc: bool,
    limit: int,
) -> list[EngineRun]:
    order = EngineRun.created_at.desc() if desc else EngineRun.created_at.asc()
    result = await db.execute(
        select(EngineRun)
        .where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
            EngineRun.created_at >= since,
        )
        .order_by(order)
        .limit(limit)
    )
    return list(result.scalars().all())


async def _avg_total_scaled(db: AsyncSession, run_id: UUID) -> float:
    row = await db.execute(
        select(func.avg(VisibilityScore.total_score)).where(
            VisibilityScore.run_id == run_id,
        )
    )
    avg = row.scalar()
    return round(float(avg or 0) * 10, 1)


async def _citation_rate_for_run(db: AsyncSession, run_id: UUID) -> float:
    total_answers = (
        await db.execute(
            select(func.count()).select_from(Answer).where(Answer.run_id == run_id),
        )
    ).scalar() or 0
    if total_answers == 0:
        return 0.0
    with_citation = (
        await db.execute(
            select(func.count(func.distinct(Citation.answer_id)))
            .join(Answer, Citation.answer_id == Answer.id)
            .where(Answer.run_id == run_id),
        )
    ).scalar() or 0
    return round(100.0 * with_citation / total_answers, 1)


async def _sov_and_rank_for_run(
    db: AsyncSession,
    project_id: UUID,
    run_id: UUID,
    brand_name: str,
) -> tuple[float, float]:
    """SoV among brand mentions (%) and avg position (lower is better)."""
    result = await db.execute(
        select(Mention.entity_name, Mention.position_in_answer)
        .join(Answer, Mention.answer_id == Answer.id)
        .where(
            Answer.run_id == run_id,
            Mention.entity_type == "brand",
        )
    )
    rows = result.all()
    if not rows:
        return 0.0, 0.0

    brand_key = brand_name.casefold()
    client_hits = 0
    positions: list[float] = []
    for name, pos in rows:
        if name.casefold() == brand_key:
            client_hits += 1
            if pos is not None:
                positions.append(float(pos))

    total = len(rows)
    sov = round(100.0 * client_hits / total, 1) if total else 0.0
    avg_rank = round(sum(positions) / len(positions), 2) if positions else 0.0
    return sov, avg_rank


async def build_project_dashboard(
    db: AsyncSession,
    project_id: UUID,
    period: str,
    brand: Brand | None,
) -> ProjectDashboardResponse:
    since = _period_start(period)
    # Latest / previous completed runs in window
    recent_desc = await _completed_runs_in_window(
        db, project_id, since, desc=True, limit=2,
    )
    latest = recent_desc[0] if recent_desc else None
    previous = recent_desc[1] if len(recent_desc) > 1 else None

    brand_name = brand.name if brand else "client"

    if latest is None:
        return ProjectDashboardResponse(
            period=period,
            overall_score=0.0,
            overall_score_delta=0.0,
            share_of_voice=0.0,
            share_of_voice_delta=0.0,
            avg_rank=0.0,
            avg_rank_delta=0.0,
            citation_rate=0.0,
            citation_rate_delta=0.0,
            sparklines={"score": [], "sov": []},
            updated_at=datetime.now(UTC),
        )

    overall = await _avg_total_scaled(db, latest.id)
    prev_overall = (
        await _avg_total_scaled(db, previous.id) if previous else overall
    )

    sov, avg_rank = await _sov_and_rank_for_run(
        db, project_id, latest.id, brand_name,
    )
    prev_sov, prev_rank = (
        await _sov_and_rank_for_run(db, project_id, previous.id, brand_name)
        if previous
        else (sov, avg_rank)
    )

    cit = await _citation_rate_for_run(db, latest.id)
    prev_cit = (
        await _citation_rate_for_run(db, previous.id) if previous else cit
    )

    # Sparklines: up to 7 completed runs, oldest → newest
    asc_runs = await _completed_runs_in_window(
        db, project_id, since, desc=False, limit=7,
    )
    score_line: list[float] = []
    sov_line: list[float] = []
    for r in asc_runs:
        score_line.append(await _avg_total_scaled(db, r.id))
        s, _ = await _sov_and_rank_for_run(db, project_id, r.id, brand_name)
        sov_line.append(s)
    while len(score_line) < 7:
        score_line.insert(0, score_line[0] if score_line else 0.0)
        sov_line.insert(0, sov_line[0] if sov_line else 0.0)
    score_line = score_line[-7:]
    sov_line = sov_line[-7:]

    updated = latest.completed_at or latest.updated_at or latest.created_at
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=UTC)

    return ProjectDashboardResponse(
        period=period,
        overall_score=overall,
        overall_score_delta=round(overall - prev_overall, 1),
        share_of_voice=sov,
        share_of_voice_delta=round(sov - prev_sov, 1),
        avg_rank=avg_rank,
        avg_rank_delta=round(avg_rank - prev_rank, 2),
        citation_rate=cit,
        citation_rate_delta=round(cit - prev_cit, 1),
        sparklines={"score": score_line, "sov": sov_line},
        updated_at=updated,
    )


async def build_platforms_table(
    db: AsyncSession,
    project_id: UUID,
) -> DashboardPlatformsResponse:
    """Per-engine visibility and SoV using all scored rows for the project."""
    eng_rows = await db.execute(
        select(
            Engine.id,
            Engine.name,
            func.avg(VisibilityScore.total_score).label("avg_total"),
        )
        .join(Engine, Engine.id == VisibilityScore.engine_id)
        .join(EngineRun, EngineRun.id == VisibilityScore.run_id)
        .where(EngineRun.project_id == project_id)
        .group_by(Engine.id, Engine.name)
    )
    engines = eng_rows.all()
    run_ids_sq = select(EngineRun.id).where(EngineRun.project_id == project_id)

    platforms: list[DashboardPlatformRow] = []
    for eid, name, avg_total in engines:
        avg_t = float(avg_total or 0)
        vis = min(100.0, round(avg_t * 10, 1))
        # SoV% from recommendation mentions on this engine / all rec mentions (project)
        result = await db.execute(
            select(
                func.count().filter(Mention.is_recommended.is_(True)).label("recs"),
            )
            .join(Answer, Mention.answer_id == Answer.id)
            .where(
                Answer.engine_id == eid,
                Answer.run_id.in_(run_ids_sq),
            )
        )
        engine_recs = result.scalar() or 0
        total_recs_result = await db.execute(
            select(func.count())
            .select_from(Mention)
            .join(Answer, Mention.answer_id == Answer.id)
            .where(
                Mention.is_recommended.is_(True),
                Answer.run_id.in_(run_ids_sq),
            )
        )
        total_recs = total_recs_result.scalar() or 0
        sov_pct = (
            round(100.0 * engine_recs / total_recs, 1) if total_recs else 0.0
        )
        # Rank: inverse visibility positioning score as pseudo-rank (1–10 scale)
        rank_result = await db.execute(
            select(func.avg(VisibilityScore.position_score)).where(
                VisibilityScore.engine_id == eid,
                VisibilityScore.run_id.in_(run_ids_sq),
            )
        )
        pos_avg = float(rank_result.scalar() or 0)
        avg_rank = round(max(1.0, 10.0 - pos_avg), 1)

        run_count_result = await db.execute(
            select(func.count())
            .select_from(EngineRun)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.engine_id == eid,
            ),
        )
        run_cnt = int(run_count_result.scalar() or 0)

        platforms.append(
            DashboardPlatformRow(
                engine=name,
                sov_pct=sov_pct,
                visibility_pct=vis,
                avg_rank=avg_rank,
                run_count=run_cnt,
            )
        )

    platforms.sort(key=lambda p: p.engine)
    return DashboardPlatformsResponse(platforms=platforms)
