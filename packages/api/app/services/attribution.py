"""Attribution service — maps content pushes to visibility score changes.

For each published content item, finds the engine run BEFORE publication
and the earliest run AFTER, then compares aggregated scores to measure
the content's impact on AI visibility.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.engine_run import EngineRun
from app.models.visibility_score import VisibilityScore

logger = logging.getLogger(__name__)

# Score dimension column names used for iteration.
_DIMENSIONS = (
    "mention",
    "sentiment",
    "position",
    "accuracy",
    "citation",
    "recommendation",
    "total",
)


def _to_float(val: Decimal | float | int | None) -> float:
    if val is None:
        return 0.0
    return float(val)


def _score_col(dimension: str) -> str:
    """Return the VisibilityScore column attribute name for a dimension."""
    return f"{dimension}_score"


class AttributionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Single content item impact
    # ------------------------------------------------------------------

    async def get_content_impact(self, content_id: UUID) -> dict | None:
        """Calculate the impact of a single content item on visibility scores.

        Returns None if the content item doesn't exist or isn't published.
        Returns a dict with before/after scores and deltas.
        """
        # 1. Load content
        result = await self.db.execute(
            select(Content).where(Content.id == content_id)
        )
        content = result.scalar_one_or_none()
        if content is None:
            return None
        if content.published_at is None:
            return {
                "content_id": str(content.id),
                "title": content.title,
                "content_type": content.content_type,
                "published_at": None,
                "status": "not_published",
                "before_run_id": None,
                "after_run_id": None,
                "before_scores": None,
                "after_scores": None,
                "deltas": None,
                "improved_dimensions": [],
                "overall_impact": None,
            }

        project_id = content.project_id
        published_at = content.published_at

        # 2. Find latest completed EngineRun BEFORE published_at
        before_run_q = (
            select(EngineRun.id)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
                EngineRun.completed_at < published_at,
            )
            .order_by(EngineRun.completed_at.desc())
            .limit(1)
        )
        before_result = await self.db.execute(before_run_q)
        before_run_id = before_result.scalar_one_or_none()

        # 3. Find earliest completed EngineRun AFTER published_at
        after_run_q = (
            select(EngineRun.id)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
                EngineRun.completed_at > published_at,
            )
            .order_by(EngineRun.completed_at.asc())
            .limit(1)
        )
        after_result = await self.db.execute(after_run_q)
        after_run_id = after_result.scalar_one_or_none()

        # 4. Calculate aggregated scores via SQL
        before_scores = await self._avg_scores_for_run(before_run_id) if before_run_id else None
        after_scores = await self._avg_scores_for_run(after_run_id) if after_run_id else None

        # 5. Compute deltas
        deltas: dict[str, float] | None = None
        improved_dimensions: list[str] = []
        overall_impact: float | None = None

        if before_scores and after_scores:
            deltas = {}
            for dim in _DIMENSIONS:
                delta = after_scores[dim] - before_scores[dim]
                deltas[dim] = round(delta, 2)
                if delta > 0:
                    improved_dimensions.append(dim)
            overall_impact = deltas["total"]

        return {
            "content_id": str(content.id),
            "title": content.title,
            "content_type": content.content_type,
            "published_at": content.published_at.isoformat() if content.published_at else None,
            "status": "measurable" if (before_scores and after_scores) else "pending",
            "before_run_id": str(before_run_id) if before_run_id else None,
            "after_run_id": str(after_run_id) if after_run_id else None,
            "before_scores": before_scores,
            "after_scores": after_scores,
            "deltas": deltas,
            "improved_dimensions": improved_dimensions,
            "overall_impact": overall_impact,
        }

    # ------------------------------------------------------------------
    # Project-level: all published content with impact
    # ------------------------------------------------------------------

    async def get_project_attribution(self, project_id: UUID) -> list[dict]:
        """Get attribution for all published content in a project.

        Sorted by overall impact (highest first). Items without measurable
        impact are placed at the end.
        """
        # Get all published content for this project
        result = await self.db.execute(
            select(Content.id)
            .where(
                Content.project_id == project_id,
                Content.status == "published",
                Content.published_at.isnot(None),
            )
            .order_by(Content.published_at.desc())
        )
        content_ids = [row[0] for row in result.all()]

        items: list[dict] = []
        for cid in content_ids:
            impact = await self.get_content_impact(cid)
            if impact is not None:
                items.append(impact)

        # Sort: measurable items by overall_impact desc, then pending items
        measurable = [i for i in items if i["overall_impact"] is not None]
        pending = [i for i in items if i["overall_impact"] is None]

        measurable.sort(key=lambda x: x["overall_impact"], reverse=True)

        return measurable + pending

    # ------------------------------------------------------------------
    # Project-level summary
    # ------------------------------------------------------------------

    async def get_attribution_summary(self, project_id: UUID) -> dict:
        """High-level attribution metrics for a project.

        Uses SQL aggregation where possible to minimize round-trips.
        """
        # Total published content count
        total_published_result = await self.db.execute(
            select(func.count())
            .select_from(Content)
            .where(
                Content.project_id == project_id,
                Content.status == "published",
                Content.published_at.isnot(None),
            )
        )
        total_published: int = total_published_result.scalar() or 0

        if total_published == 0:
            return {
                "project_id": str(project_id),
                "total_published": 0,
                "measurable_count": 0,
                "avg_impact": None,
                "best_content": None,
                "worst_content": None,
                "score_trajectory": [],
            }

        # Get attribution for all content (needed for summary stats)
        all_attribution = await self.get_project_attribution(project_id)

        measurable = [a for a in all_attribution if a["overall_impact"] is not None]
        measurable_count = len(measurable)

        avg_impact: float | None = None
        best_content: dict | None = None
        worst_content: dict | None = None

        if measurable:
            impacts = [a["overall_impact"] for a in measurable]
            avg_impact = round(sum(impacts) / len(impacts), 2)

            # Best = highest positive impact
            best = max(measurable, key=lambda x: x["overall_impact"])
            best_content = {
                "content_id": best["content_id"],
                "title": best["title"],
                "impact": best["overall_impact"],
            }

            # Worst = lowest (most negative) impact
            worst = min(measurable, key=lambda x: x["overall_impact"])
            worst_content = {
                "content_id": worst["content_id"],
                "title": worst["title"],
                "impact": worst["overall_impact"],
            }

        # Score trajectory: avg total score per completed run over time
        trajectory = await self._score_trajectory(project_id)

        return {
            "project_id": str(project_id),
            "total_published": total_published,
            "measurable_count": measurable_count,
            "avg_impact": avg_impact,
            "best_content": best_content,
            "worst_content": worst_content,
            "score_trajectory": trajectory,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _avg_scores_for_run(self, run_id: UUID) -> dict[str, float] | None:
        """Return average scores across all VisibilityScore rows for a run.

        Uses a single SQL aggregation query.
        """
        result = await self.db.execute(
            select(
                func.count().label("count"),
                func.avg(VisibilityScore.mention_score).label("avg_mention"),
                func.avg(VisibilityScore.sentiment_score).label("avg_sentiment"),
                func.avg(VisibilityScore.position_score).label("avg_position"),
                func.avg(VisibilityScore.accuracy_score).label("avg_accuracy"),
                func.avg(VisibilityScore.citation_score).label("avg_citation"),
                func.avg(VisibilityScore.recommendation_score).label("avg_recommendation"),
                func.avg(VisibilityScore.total_score).label("avg_total"),
            ).where(VisibilityScore.run_id == run_id)
        )
        row = result.one()

        if row.count == 0:
            return None

        return {
            "mention": round(_to_float(row.avg_mention), 2),
            "sentiment": round(_to_float(row.avg_sentiment), 2),
            "position": round(_to_float(row.avg_position), 2),
            "accuracy": round(_to_float(row.avg_accuracy), 2),
            "citation": round(_to_float(row.avg_citation), 2),
            "recommendation": round(_to_float(row.avg_recommendation), 2),
            "total": round(_to_float(row.avg_total), 2),
        }

    async def _score_trajectory(
        self, project_id: UUID, limit: int = 20
    ) -> list[dict]:
        """Average total visibility score per completed run, ordered by time.

        Returns a list of {run_id, completed_at, avg_total} dicts — useful
        for plotting score changes over time and correlating with content
        publication dates.
        """
        # Subquery: completed runs for this project, ordered by time
        runs_sq = (
            select(EngineRun.id, EngineRun.completed_at)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
                EngineRun.completed_at.isnot(None),
            )
            .order_by(EngineRun.completed_at.asc())
            .limit(limit)
            .subquery()
        )

        result = await self.db.execute(
            select(
                runs_sq.c.id.label("run_id"),
                runs_sq.c.completed_at,
                func.avg(VisibilityScore.total_score).label("avg_total"),
            )
            .join(VisibilityScore, VisibilityScore.run_id == runs_sq.c.id)
            .group_by(runs_sq.c.id, runs_sq.c.completed_at)
            .order_by(runs_sq.c.completed_at.asc())
        )
        rows = result.all()

        return [
            {
                "run_id": str(row.run_id),
                "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                "avg_total": round(_to_float(row.avg_total), 2),
            }
            for row in rows
        ]
