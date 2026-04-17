from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.citation import Citation
from app.models.content_push_event import ContentPushEvent
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.project import Project
from app.models.visibility_score import VisibilityScore


@dataclass
class RunMetrics:
    total_score: Decimal
    mentions: int
    citations: int
    run_id: UUID | None


class ContentAuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _verify_project(self, project_id: UUID, tenant_id: UUID) -> Project:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == tenant_id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError("project_not_found")
        return project

    async def _latest_completed_run(
        self,
        project_id: UUID,
        *,
        before_or_equal: datetime | None = None,
        after_or_equal: datetime | None = None,
    ) -> EngineRun | None:
        query: Select[tuple[EngineRun]] = select(EngineRun).where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
        )
        if before_or_equal is not None:
            query = query.where(EngineRun.completed_at.is_not(None))
            query = query.where(EngineRun.completed_at <= before_or_equal)
        if after_or_equal is not None:
            query = query.where(EngineRun.completed_at.is_not(None))
            query = query.where(EngineRun.completed_at >= after_or_equal)
        query = query.order_by(EngineRun.completed_at.desc()).limit(1)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _metrics_for_run(self, run_id: UUID | None) -> RunMetrics:
        if run_id is None:
            return RunMetrics(
                total_score=Decimal("0.00"),
                mentions=0,
                citations=0,
                run_id=None,
            )

        score_q = await self.db.execute(
            select(func.avg(VisibilityScore.total_score)).where(VisibilityScore.run_id == run_id)
        )
        avg_total = score_q.scalar() or Decimal("0.00")

        mention_q = await self.db.execute(
            select(func.count())
            .select_from(Mention)
            .join(Answer, Answer.id == Mention.answer_id)
            .where(Answer.run_id == run_id)
        )
        mentions = int(mention_q.scalar() or 0)

        citation_q = await self.db.execute(
            select(func.count())
            .select_from(Citation)
            .join(Answer, Answer.id == Citation.answer_id)
            .where(Answer.run_id == run_id)
        )
        citations = int(citation_q.scalar() or 0)

        return RunMetrics(
            total_score=Decimal(avg_total).quantize(Decimal("0.01")),
            mentions=mentions,
            citations=citations,
            run_id=run_id,
        )

    async def create_push_event(
        self,
        *,
        project_id: UUID,
        tenant_id: UUID,
        user_id: UUID | None,
        content_title: str | None,
        content_url: str | None,
        published_at: datetime | None,
        delay_hours: int,
        status: str,
    ) -> ContentPushEvent:
        await self._verify_project(project_id, tenant_id)
        now = datetime.utcnow()
        published = published_at or now
        baseline_run = await self._latest_completed_run(project_id, before_or_equal=published)
        baseline = await self._metrics_for_run(baseline_run.id if baseline_run else None)

        event = ContentPushEvent(
            project_id=project_id,
            triggered_by_user_id=user_id,
            content_title=content_title,
            content_url=content_url,
            published_at=published,
            recheck_at=published + timedelta(hours=max(0, delay_hours)),
            status=status,
            baseline_total_score=baseline.total_score,
            baseline_mentions=baseline.mentions,
            baseline_citations=baseline.citations,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def execute_event_audit(
        self,
        *,
        event_id: UUID,
        expected_tenant_id: UUID | None = None,
    ) -> ContentPushEvent:
        event = await self.db.get(ContentPushEvent, event_id)
        if event is None:
            raise ValueError("event_not_found")

        if expected_tenant_id is not None:
            await self._verify_project(event.project_id, expected_tenant_id)

        after_run = await self._latest_completed_run(
            event.project_id,
            after_or_equal=event.published_at,
        )
        after = await self._metrics_for_run(after_run.id if after_run else None)

        event.checked_total_score = after.total_score
        event.checked_mentions = after.mentions
        event.checked_citations = after.citations
        event.delta_total_score = (
            after.total_score - Decimal(event.baseline_total_score)
        ).quantize(Decimal("0.01"))
        event.delta_mentions = after.mentions - int(event.baseline_mentions)
        event.delta_citations = after.citations - int(event.baseline_citations)
        event.status = "completed"
        event.error_message = None
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def list_events(
        self,
        *,
        project_id: UUID,
        tenant_id: UUID,
        limit: int = 50,
    ) -> list[ContentPushEvent]:
        await self._verify_project(project_id, tenant_id)
        result = await self.db.execute(
            select(ContentPushEvent)
            .where(ContentPushEvent.project_id == project_id)
            .order_by(ContentPushEvent.published_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def summary(self, *, project_id: UUID, tenant_id: UUID) -> dict:
        await self._verify_project(project_id, tenant_id)
        result = await self.db.execute(
            select(ContentPushEvent).where(ContentPushEvent.project_id == project_id)
        )
        rows = list(result.scalars().all())
        completed = [r for r in rows if r.status == "completed"]

        if completed:
            avg_delta_total = float(
                sum(float(r.delta_total_score or 0) for r in completed) / len(completed)
            )
        else:
            avg_delta_total = 0.0

        return {
            "project_id": project_id,
            "total_events": len(rows),
            "completed_events": len(completed),
            "avg_delta_total_score": round(avg_delta_total, 2),
            "total_delta_mentions": int(sum(int(r.delta_mentions or 0) for r in completed)),
            "total_delta_citations": int(sum(int(r.delta_citations or 0) for r in completed)),
        }
