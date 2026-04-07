"""Report generator service — auto-generates reports from pipeline data.

Produces three report types:
- visibility_audit: scores summary, per-engine breakdown, top gaps, competitor mentions
- competitive_analysis: competitor mention rates, sentiment comparison, positioning
- content_performance: published content items and their impact on scores
"""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.content import Content
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.project import Project
from app.models.report import Report
from app.models.visibility_score import VisibilityScore
from app.services.scoring import ScoringService, _to_float

logger = logging.getLogger(__name__)


class ReportGeneratorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _verify_project(self, project_id: UUID, tenant_id: UUID) -> Project:
        """Return the project or raise ValueError."""
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == tenant_id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError("Project not found")
        return project

    async def _resolve_run(self, project_id: UUID, run_id: UUID | None) -> EngineRun | None:
        """If run_id given, fetch it; otherwise use latest completed run for the project."""
        if run_id:
            result = await self.db.execute(
                select(EngineRun).where(
                    EngineRun.id == run_id,
                    EngineRun.project_id == project_id,
                )
            )
            return result.scalar_one_or_none()

        result = await self.db.execute(
            select(EngineRun)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
            )
            .order_by(EngineRun.completed_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _get_engine_name_map(self, engine_ids: list[UUID]) -> dict[UUID, str]:
        """Return {engine_id: engine_name} for the given IDs."""
        if not engine_ids:
            return {}
        result = await self.db.execute(
            select(Engine.id, Engine.name).where(Engine.id.in_(engine_ids))
        )
        return {row.id: row.name for row in result.all()}

    # ------------------------------------------------------------------
    # Visibility Audit Report
    # ------------------------------------------------------------------

    async def generate_visibility_audit(
        self,
        project_id: UUID,
        tenant_id: UUID,
        run_id: UUID | None = None,
    ) -> Report:
        """Generate a visibility audit report from pipeline run data.

        Gathers: overall score summary, per-engine breakdown, top scoring gaps,
        and competitor mention analysis.
        """
        await self._verify_project(project_id, tenant_id)
        run = await self._resolve_run(project_id, run_id)

        data: dict = {
            "report_type": "visibility_audit",
            "generated_at": datetime.utcnow().isoformat(),
            "run_id": str(run.id) if run else None,
        }

        if run is None:
            data["summary"] = {"message": "No completed runs found for this project."}
            data["by_engine"] = []
            data["top_gaps"] = []
            data["competitor_mentions"] = []
        else:
            scoring = ScoringService(self.db)

            # Overall summary
            summary = await scoring.get_run_summary(run.id)
            data["summary"] = summary

            # Per-engine breakdown
            by_engine = await scoring.get_scores_by_engine(project_id)
            engine_ids = [UUID(e["engine_id"]) for e in by_engine]
            engine_names = await self._get_engine_name_map(engine_ids)
            for entry in by_engine:
                entry["engine_name"] = engine_names.get(UUID(entry["engine_id"]), "Unknown")
            data["by_engine"] = by_engine

            # Top gaps: dimensions with lowest average scores
            if summary.get("score_count", 0) > 0:
                dimensions = [
                    ("mention", summary.get("avg_mention", 0)),
                    ("sentiment", summary.get("avg_sentiment", 0)),
                    ("position", summary.get("avg_position", 0)),
                    ("accuracy", summary.get("avg_accuracy", 0)),
                    ("citation", summary.get("avg_citation", 0)),
                    ("recommendation", summary.get("avg_recommendation", 0)),
                ]
                dimensions.sort(key=lambda x: x[1])
                data["top_gaps"] = [
                    {"dimension": d[0], "avg_score": d[1]}
                    for d in dimensions[:3]
                ]
            else:
                data["top_gaps"] = []

            # Competitor mentions from this run's answers
            competitor_mentions = await self._get_competitor_mentions(run.id)
            data["competitor_mentions"] = competitor_mentions

        title = "Visibility Audit Report"
        if run and run.completed_at:
            title = f"Visibility Audit — {run.completed_at.strftime('%b %d, %Y')}"

        report = Report(
            title=title,
            report_type="visibility_audit",
            project_id=project_id,
            data_json=data,
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)

        logger.info("Generated visibility audit report %s for project %s", report.id, project_id)
        return report

    async def _get_competitor_mentions(self, run_id: UUID) -> list[dict]:
        """Aggregate competitor mentions for a run."""
        result = await self.db.execute(
            select(
                Mention.entity_name,
                Mention.sentiment,
                func.count().label("count"),
            )
            .join(Answer, Answer.id == Mention.answer_id)
            .where(
                Answer.run_id == run_id,
                Mention.entity_type == "competitor",
            )
            .group_by(Mention.entity_name, Mention.sentiment)
        )
        rows = result.all()

        # Group by entity_name
        competitors: dict[str, dict] = {}
        for row in rows:
            name = row.entity_name
            if name not in competitors:
                competitors[name] = {
                    "name": name,
                    "total_mentions": 0,
                    "sentiment_breakdown": {},
                }
            competitors[name]["total_mentions"] += row.count
            competitors[name]["sentiment_breakdown"][row.sentiment] = row.count

        return list(competitors.values())

    # ------------------------------------------------------------------
    # Competitive Analysis Report
    # ------------------------------------------------------------------

    async def generate_competitive_analysis(
        self,
        project_id: UUID,
        tenant_id: UUID,
        run_id: UUID | None = None,
    ) -> Report:
        """Generate a competitive analysis report.

        Compares competitor mention rates, sentiment, and positioning
        against the brand across AI engine answers.
        """
        await self._verify_project(project_id, tenant_id)
        run = await self._resolve_run(project_id, run_id)

        data: dict = {
            "report_type": "competitive_analysis",
            "generated_at": datetime.utcnow().isoformat(),
            "run_id": str(run.id) if run else None,
        }

        if run is None:
            data["brand_mentions"] = {}
            data["competitor_analysis"] = []
            data["positioning"] = {"message": "No completed runs found."}
        else:
            # Brand mention stats
            brand_stats = await self._get_entity_mention_stats(run.id, "brand")
            data["brand_mentions"] = brand_stats

            # Competitor mention stats
            competitor_stats = await self._get_entity_mention_stats(run.id, "competitor")
            data["competitor_analysis"] = competitor_stats

            # Positioning comparison
            total_answers = await self._count_answers(run.id)
            brand_rate = (
                brand_stats.get("total_mentions", 0) / total_answers * 100
                if total_answers > 0
                else 0
            )

            competitor_entries = []
            if isinstance(competitor_stats, list):
                for comp in competitor_stats:
                    comp_rate = (
                        comp.get("total_mentions", 0) / total_answers * 100
                        if total_answers > 0
                        else 0
                    )
                    competitor_entries.append({
                        "name": comp.get("name", "Unknown"),
                        "mention_rate_pct": round(comp_rate, 1),
                        "sentiment_breakdown": comp.get("sentiment_breakdown", {}),
                    })

            data["positioning"] = {
                "total_answers": total_answers,
                "brand_mention_rate_pct": round(brand_rate, 1),
                "competitors": competitor_entries,
            }

        title = "Competitive Analysis Report"
        if run and run.completed_at:
            title = f"Competitive Analysis — {run.completed_at.strftime('%b %d, %Y')}"

        report = Report(
            title=title,
            report_type="competitive_analysis",
            project_id=project_id,
            data_json=data,
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)

        logger.info("Generated competitive analysis report %s for project %s", report.id, project_id)
        return report

    async def _get_entity_mention_stats(
        self, run_id: UUID, entity_type: str
    ) -> dict | list[dict]:
        """Get aggregated mention stats for a given entity type in a run.

        For 'brand': returns a single dict with totals.
        For 'competitor': returns a list of dicts, one per competitor.
        """
        result = await self.db.execute(
            select(
                Mention.entity_name,
                Mention.sentiment,
                func.count().label("count"),
                func.avg(Mention.position_in_answer).label("avg_position"),
            )
            .join(Answer, Answer.id == Mention.answer_id)
            .where(
                Answer.run_id == run_id,
                Mention.entity_type == entity_type,
            )
            .group_by(Mention.entity_name, Mention.sentiment)
        )
        rows = result.all()

        entities: dict[str, dict] = {}
        for row in rows:
            name = row.entity_name
            if name not in entities:
                entities[name] = {
                    "name": name,
                    "total_mentions": 0,
                    "sentiment_breakdown": {},
                    "avg_position": None,
                }
            entities[name]["total_mentions"] += row.count
            entities[name]["sentiment_breakdown"][row.sentiment] = row.count
            if row.avg_position is not None:
                entities[name]["avg_position"] = round(_to_float(row.avg_position), 1)

        if entity_type == "brand":
            # Return single aggregated dict for the brand
            if entities:
                return list(entities.values())[0]
            return {"name": "N/A", "total_mentions": 0, "sentiment_breakdown": {}}

        return list(entities.values())

    async def _count_answers(self, run_id: UUID) -> int:
        """Count total answers in a run."""
        result = await self.db.execute(
            select(func.count()).select_from(Answer).where(Answer.run_id == run_id)
        )
        return result.scalar() or 0

    # ------------------------------------------------------------------
    # Content Performance Report
    # ------------------------------------------------------------------

    async def generate_content_performance(
        self,
        project_id: UUID,
        tenant_id: UUID,
    ) -> Report:
        """Generate a content performance report.

        Analyzes published content items and correlates them with visibility
        score trends to measure impact.
        """
        await self._verify_project(project_id, tenant_id)

        data: dict = {
            "report_type": "content_performance",
            "generated_at": datetime.utcnow().isoformat(),
        }

        # Get published content items
        content_result = await self.db.execute(
            select(Content)
            .where(
                Content.project_id == project_id,
                Content.status == "published",
            )
            .order_by(Content.published_at.desc())
        )
        content_items = list(content_result.scalars().all())

        content_data = []
        for item in content_items:
            content_data.append({
                "id": str(item.id),
                "title": item.title,
                "content_type": item.content_type,
                "published_at": item.published_at.isoformat() if item.published_at else None,
            })
        data["published_content"] = content_data
        data["total_published"] = len(content_data)

        # Get score trends to correlate with content publication
        scoring = ScoringService(self.db)
        trends = await scoring.get_score_trends(project_id, limit=20)
        data["score_trends"] = trends

        # Compute content impact: compare avg scores before vs after content publication
        if content_items and trends:
            impact = self._compute_content_impact(content_items, trends)
            data["content_impact"] = impact
        else:
            data["content_impact"] = {
                "message": "Insufficient data to compute content impact."
            }

        # Content type breakdown
        type_counts: dict[str, int] = {}
        for item in content_items:
            ct = item.content_type
            type_counts[ct] = type_counts.get(ct, 0) + 1
        data["content_type_breakdown"] = type_counts

        title = f"Content Performance Report — {datetime.utcnow().strftime('%b %d, %Y')}"

        report = Report(
            title=title,
            report_type="content_performance",
            project_id=project_id,
            data_json=data,
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)

        logger.info(
            "Generated content performance report %s for project %s", report.id, project_id
        )
        return report

    @staticmethod
    def _compute_content_impact(
        content_items: list[Content],
        trends: list[dict],
    ) -> dict:
        """Compare average visibility scores before and after the earliest content publication.

        Returns a before/after comparison with delta.
        """
        # Find earliest published_at
        published_dates = [
            c.published_at for c in content_items if c.published_at is not None
        ]
        if not published_dates:
            return {"message": "No content with publication dates."}

        earliest = min(published_dates)

        # Split trends into before and after
        before_scores: list[float] = []
        after_scores: list[float] = []

        for trend in trends:
            created_at = trend.get("created_at")
            if created_at is None:
                continue
            trend_dt = datetime.fromisoformat(created_at)
            avg_total = trend.get("avg_total", 0)
            if trend_dt < earliest:
                before_scores.append(avg_total)
            else:
                after_scores.append(avg_total)

        avg_before = round(sum(before_scores) / len(before_scores), 2) if before_scores else 0
        avg_after = round(sum(after_scores) / len(after_scores), 2) if after_scores else 0
        delta = round(avg_after - avg_before, 2)

        return {
            "earliest_publication": earliest.isoformat(),
            "runs_before": len(before_scores),
            "runs_after": len(after_scores),
            "avg_score_before": avg_before,
            "avg_score_after": avg_after,
            "score_delta": delta,
        }
