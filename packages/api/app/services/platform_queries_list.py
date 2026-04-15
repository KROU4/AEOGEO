"""List answers/queries for a single engine within a project."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.answer import Answer
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.schemas.platform_queries import PlatformQueriesResponse, PlatformQueryRow


async def list_platform_queries(
    db: AsyncSession,
    project_id: UUID,
    engine_slug: str,
    *,
    sort: str,
    order: str,
    page: int,
    page_size: int,
) -> PlatformQueriesResponse | None:
    eng = await db.scalar(select(Engine).where(Engine.slug == engine_slug))
    if eng is None:
        return None

    result = await db.execute(
        select(Answer)
        .join(EngineRun, Answer.run_id == EngineRun.id)
        .where(
            EngineRun.project_id == project_id,
            Answer.engine_id == eng.id,
        )
        .options(
            selectinload(Answer.mentions),
            selectinload(Answer.citations),
        ),
    )
    answers = list(result.scalars().all())

    def brand_positions(a: Answer) -> int | None:
        pos = [
            m.position_in_answer
            for m in a.mentions
            if m.entity_type == "brand" and m.position_in_answer is not None
        ]
        return min(pos) if pos else None

    def rank_value(a: Answer) -> float:
        p = brand_positions(a)
        return float(p) if p is not None else 999.0

    def cit_count(a: Answer) -> int:
        return len(a.citations)

    reverse = order == "desc"
    if sort == "rank":
        answers.sort(key=rank_value, reverse=not reverse)
    elif sort == "citation_rate":
        answers.sort(key=cit_count, reverse=reverse)
    else:
        answers.sort(
            key=lambda a: a.created_at.timestamp() if a.created_at else 0,
            reverse=reverse,
        )

    total = len(answers)
    start = (page - 1) * page_size
    slice_a = answers[start : start + page_size]

    rows: list[PlatformQueryRow] = []
    for a in slice_a:
        bp = brand_positions(a)
        brand_ms = [m for m in a.mentions if m.entity_type == "brand"]
        rows.append(
            PlatformQueryRow(
                query_text=a.query_text,
                rank=int(bp) if bp is not None else 0,
                brand_mentioned=len(brand_ms) > 0,
                mention_position=bp,
                citation_count=len(a.citations),
                answer_id=a.id,
            ),
        )

    return PlatformQueriesResponse(
        engine=engine_slug,
        queries=rows,
        total=total,
    )
