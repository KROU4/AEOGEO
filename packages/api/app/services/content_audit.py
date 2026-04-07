"""Content Audit Service -- automated re-measurement 48h after publication.

After a content item is published, we wait 48 hours for search engines and AI
models to index/ingest the new content, then trigger a visibility measurement
run to compare before/after scores.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.engine import ProjectEngine
from app.models.engine_run import EngineRun
from app.models.query import QuerySet
from app.models.visibility_score import VisibilityScore

logger = logging.getLogger(__name__)


def _to_float(val: Decimal | float | int | None) -> float:
    if val is None:
        return 0.0
    return float(val)


class ContentAuditService:
    """Finds published content needing audit and triggers measurement runs."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # 1. Find content needing audit
    # ------------------------------------------------------------------

    async def find_content_needing_audit(self) -> list[Content]:
        """Find published content where published_at was 48+ hours ago
        and no audit run exists yet.

        An audit run is an EngineRun with triggered_by='content_audit'
        for the same project, created after the content's published_at.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

        # Subquery: does a content_audit run already exist for this
        # content's project after the content's published_at?
        audit_run_exists = (
            select(EngineRun.id)
            .where(
                EngineRun.project_id == Content.project_id,
                EngineRun.triggered_by == "content_audit",
                EngineRun.created_at >= Content.published_at,
            )
            .correlate(Content)
            .exists()
        )

        result = await self.db.execute(
            select(Content).where(
                Content.status == "published",
                Content.published_at.isnot(None),
                Content.published_at <= cutoff,
                ~audit_run_exists,
            )
        )

        items = list(result.scalars().all())
        logger.info(
            "Found %d content items needing audit (cutoff=%s)",
            len(items),
            cutoff.isoformat(),
        )
        return items

    # ------------------------------------------------------------------
    # 2. Trigger an audit run
    # ------------------------------------------------------------------

    async def trigger_audit_run(self, content_id: UUID) -> list[EngineRun]:
        """Create engine runs for the content's project to measure post-publication impact.

        Uses the project's latest query set and all active engines.
        Returns the list of created EngineRun records (one per active engine).
        """
        # Load the content
        content_result = await self.db.execute(
            select(Content).where(Content.id == content_id)
        )
        content = content_result.scalar_one_or_none()
        if content is None:
            raise ValueError(f"Content {content_id} not found")

        project_id = content.project_id

        # Find the project's latest query set (most recently created)
        qs_result = await self.db.execute(
            select(QuerySet)
            .where(QuerySet.project_id == project_id)
            .order_by(QuerySet.created_at.desc())
            .limit(1)
        )
        query_set = qs_result.scalar_one_or_none()
        if query_set is None:
            logger.warning(
                "No query set found for project %s, skipping audit for content %s",
                project_id,
                content_id,
            )
            return []

        # Find active engines for the project
        pe_result = await self.db.execute(
            select(ProjectEngine)
            .where(
                ProjectEngine.project_id == project_id,
                ProjectEngine.is_active.is_(True),
            )
            .options(selectinload(ProjectEngine.engine))
        )
        project_engines = list(pe_result.scalars().all())

        if not project_engines:
            logger.warning(
                "No active engines for project %s, skipping audit for content %s",
                project_id,
                content_id,
            )
            return []

        # Create one EngineRun per active engine
        runs: list[EngineRun] = []
        for pe in project_engines:
            run = EngineRun(
                project_id=project_id,
                query_set_id=query_set.id,
                engine_id=pe.engine_id,
                sample_count=1,
                triggered_by="content_audit",
                status="pending",
            )
            self.db.add(run)
            runs.append(run)

        await self.db.flush()

        for run in runs:
            await self.db.refresh(run)

        logger.info(
            "Created %d audit runs for content %s (project %s)",
            len(runs),
            content_id,
            project_id,
        )
        return runs

    # ------------------------------------------------------------------
    # 3. Get before/after audit results
    # ------------------------------------------------------------------

    async def get_audit_results(self, content_id: UUID) -> dict:
        """Get before/after scores for a content item.

        - "before" = the latest completed run before content.published_at
        - "after"  = the content_audit run triggered after publication

        Returns a dict with before_score, after_score, delta, and
        per-dimension breakdowns.
        """
        # Load the content
        content_result = await self.db.execute(
            select(Content).where(Content.id == content_id)
        )
        content = content_result.scalar_one_or_none()
        if content is None:
            return {"error": "content_not_found"}

        if content.published_at is None:
            return {"error": "content_not_published"}

        project_id = content.project_id
        published_at = content.published_at

        # Find the "before" run: latest completed run before published_at
        before_run_result = await self.db.execute(
            select(EngineRun)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
                EngineRun.completed_at.isnot(None),
                EngineRun.completed_at <= published_at,
            )
            .order_by(EngineRun.completed_at.desc())
            .limit(1)
        )
        before_run = before_run_result.scalar_one_or_none()

        # Find the "after" run: the audit run triggered after publication
        after_run_result = await self.db.execute(
            select(EngineRun)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.triggered_by == "content_audit",
                EngineRun.status == "completed",
                EngineRun.created_at >= published_at,
            )
            .order_by(EngineRun.created_at.asc())
            .limit(1)
        )
        after_run = after_run_result.scalar_one_or_none()

        before_scores = await self._aggregate_run_scores(before_run.id) if before_run else None
        after_scores = await self._aggregate_run_scores(after_run.id) if after_run else None

        # Compute delta
        delta = None
        improved_dimensions: list[str] = []
        if before_scores and after_scores:
            delta = {
                dim: round(after_scores[dim] - before_scores[dim], 2)
                for dim in before_scores
            }
            improved_dimensions = [
                dim for dim, change in delta.items() if change > 0
            ]

        return {
            "content_id": str(content_id),
            "published_at": published_at.isoformat() if published_at else None,
            "before_run_id": str(before_run.id) if before_run else None,
            "after_run_id": str(after_run.id) if after_run else None,
            "before_scores": before_scores,
            "after_scores": after_scores,
            "delta": delta,
            "improved_dimensions": improved_dimensions,
            "status": self._determine_audit_status(before_run, after_run),
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _aggregate_run_scores(self, run_id: UUID) -> dict[str, float]:
        """Get average scores across all dimensions for a run."""
        result = await self.db.execute(
            select(
                func.avg(VisibilityScore.total_score).label("total"),
                func.avg(VisibilityScore.mention_score).label("mention"),
                func.avg(VisibilityScore.sentiment_score).label("sentiment"),
                func.avg(VisibilityScore.position_score).label("position"),
                func.avg(VisibilityScore.accuracy_score).label("accuracy"),
                func.avg(VisibilityScore.citation_score).label("citation"),
                func.avg(VisibilityScore.recommendation_score).label("recommendation"),
            ).where(VisibilityScore.run_id == run_id)
        )
        row = result.one()
        return {
            "total": round(_to_float(row.total), 2),
            "mention": round(_to_float(row.mention), 2),
            "sentiment": round(_to_float(row.sentiment), 2),
            "position": round(_to_float(row.position), 2),
            "accuracy": round(_to_float(row.accuracy), 2),
            "citation": round(_to_float(row.citation), 2),
            "recommendation": round(_to_float(row.recommendation), 2),
        }

    @staticmethod
    def _determine_audit_status(
        before_run: EngineRun | None, after_run: EngineRun | None
    ) -> str:
        """Return a human-readable audit status string."""
        if after_run is None:
            return "pending"  # audit run not yet created or not yet completed
        if before_run is None:
            return "no_baseline"  # no pre-publication run to compare against
        return "completed"
