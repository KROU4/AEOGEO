"""Derive character spans in raw answer text for brand mentions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.answer import Answer
from app.models.engine_run import EngineRun
from app.schemas.project_answer import BrandMentionSpan, ProjectAnswerDetailResponse


def _spans_for_brand(raw: str, brand_name: str) -> list[tuple[int, int]]:
    raw_l = raw.lower()
    needle = brand_name.lower().strip()
    if not needle:
        return []
    spans: list[tuple[int, int]] = []
    start = 0
    while True:
        i = raw_l.find(needle, start)
        if i < 0:
            break
        spans.append((i, i + len(brand_name)))
        start = i + 1
    return spans


async def build_project_answer_detail(
    db: AsyncSession,
    project_id: UUID,
    answer_id: UUID,
) -> ProjectAnswerDetailResponse | None:
    result = await db.execute(
        select(Answer)
        .join(EngineRun, Answer.run_id == EngineRun.id)
        .where(
            Answer.id == answer_id,
            EngineRun.project_id == project_id,
        )
        .options(selectinload(Answer.mentions)),
    )
    answer = result.scalar_one_or_none()
    if answer is None:
        return None

    raw = answer.raw_response or ""
    spans_out: list[BrandMentionSpan] = []
    seen: set[tuple[int, int, str]] = set()
    for m in answer.mentions:
        if m.entity_type != "brand":
            continue
        name = m.entity_name.strip()
        if not name:
            continue
        for start, end in _spans_for_brand(raw, name)[:3]:
            key = (start, end, name)
            if key in seen:
                continue
            seen.add(key)
            spans_out.append(BrandMentionSpan(brand=name, start=start, end=end))

    spans_out.sort(key=lambda s: s.start)
    return ProjectAnswerDetailResponse(
        answer_id=answer.id,
        engine=answer.engine_name.lower().replace(" ", "_"),
        query_text=answer.query_text,
        raw_text=raw,
        brand_mentions=spans_out,
    )
