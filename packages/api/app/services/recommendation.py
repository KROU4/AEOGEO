"""Recommendation service — AI-powered improvement suggestions."""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.engine_run import EngineRun
from app.models.keyword import Keyword
from app.models.project import Project
from app.models.recommendation import Recommendation
from app.schemas.recommendation import (
    RecommendationGenerateResponse,
    RecommendationResponse,
)
from app.services.ai_client import AIClient
from app.services.scoring import ScoringService
from app.utils.locale import locale_instruction

logger = logging.getLogger(__name__)

RECOMMENDATION_SYSTEM_PROMPT = """\
You are an AI visibility strategist.
Analyze a brand's visibility scores across AI answer engines
and generate specific, actionable improvement recommendations.

Return JSON in this shape:
{
  "recommendations": [
    {
      "category": "content|seo|brand_positioning|technical",
      "priority": "high|medium|low",
      "title": "Short actionable title",
      "description": "Detailed recommendation with specific steps",
      "affected_keywords": ["keyword1", "keyword2"]
    }
  ]
}

Categories:
- content: Create or improve content (FAQ pages, blog posts, structured data)
- seo: Search and discoverability improvements (structured data, citations, links)
- brand_positioning: How the brand is described and positioned in AI answers
- technical: Technical improvements (JSON-LD, schema markup, site structure)

Rules:
- Analyze the scores to identify weak areas
  (low mention, negative sentiment, poor citation rate).
- Each recommendation should be specific and actionable, not generic advice.
- Reference specific keywords or query areas where possible.
- Priority should reflect impact: high = significant visibility improvement expected.
- Generate 5-10 recommendations, ordered by priority.
- Return only valid JSON.
"""


class RecommendationServiceError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class RecommendationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_recommendations(
        self,
        project_id: UUID,
        tenant_id: UUID,
    ) -> list[RecommendationResponse]:
        await self._verify_project(project_id, tenant_id)

        result = await self.db.scalars(
            select(Recommendation)
            .where(Recommendation.project_id == project_id)
            .order_by(Recommendation.created_at.desc())
        )
        return [RecommendationResponse.model_validate(x) for x in result.all()]

    async def patch_recommendation_status(
        self,
        project_id: UUID,
        rec_id: UUID,
        tenant_id: UUID,
        status: str,
    ) -> RecommendationResponse:
        await self._verify_project(project_id, tenant_id)
        result = await self.db.execute(
            select(Recommendation).where(
                Recommendation.id == rec_id,
                Recommendation.project_id == project_id,
            ),
        )
        rec = result.scalar_one_or_none()
        if rec is None:
            raise RecommendationServiceError(404, "rec.not_found", "Not found")
        rec.status = status
        await self.db.commit()
        await self.db.refresh(rec)
        return RecommendationResponse.model_validate(rec)

    async def generate_recommendations(
        self,
        project_id: UUID,
        tenant_id: UUID,
        ai_client: AIClient,
        run_id: UUID | None = None,
    ) -> RecommendationGenerateResponse:
        project = await self._verify_project(project_id, tenant_id)

        # Find the run to analyze
        if run_id is not None:
            result = await self.db.execute(
                select(EngineRun).where(
                    EngineRun.id == run_id,
                    EngineRun.project_id == project_id,
                )
            )
            run = result.scalar_one_or_none()
            if run is None:
                raise RecommendationServiceError(404, "run.not_found", "Run not found")
        else:
            result = await self.db.execute(
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
                raise RecommendationServiceError(
                    404,
                    "run.not_found",
                    "No completed runs found. Run an AI check first.",
                )

        # Load scoring data
        scoring = ScoringService(self.db)
        summary = await scoring.get_run_summary(run.id)
        by_query = await scoring.get_scores_by_query(run.id)

        # Load brand context
        brand = await self.db.scalar(
            select(Brand).where(Brand.project_id == project_id)
        )

        # Load keywords
        keywords = list(
            (
                await self.db.scalars(
                    select(Keyword)
                    .where(
                        Keyword.project_id == project_id,
                        Keyword.is_selected.is_(True),
                    )
                    .limit(50)
                )
            ).all()
        )

        # Build prompt
        prompt = self._build_prompt(
            brand=brand,
            summary=summary,
            by_query=by_query,
            keywords=keywords,
            knowledge_count=0,
            content_locale=project.content_locale or "en",
        )

        response = await ai_client.complete(
            provider="openai",
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": RECOMMENDATION_SYSTEM_PROMPT
                    + locale_instruction(project.content_locale or "en"),
                },
                {"role": "user", "content": prompt},
            ],
            request_type="recommendation_generation",
            temperature=0.3,
            max_tokens=2048,
        )
        await self.db.commit()

        parsed = self._parse_json_payload(response.content)
        raw_recs = self._extract_recommendations(parsed)

        # Replace existing recommendations
        await self.db.execute(
            delete(Recommendation).where(Recommendation.project_id == project_id)
        )

        recommendations = []
        for idx, item in enumerate(raw_recs):
            cat = item["category"]
            scope = (
                "internal" if cat in ("technical", "content") else "external"
            )
            rec = Recommendation(
                category=cat,
                priority=item["priority"],
                title=item["title"],
                description=item["description"],
                affected_keywords=item.get("affected_keywords"),
                run_id=run.id,
                project_id=project_id,
                status="pending",
                sort_rank=idx + 1,
                scope=scope,
                impact_estimate=item.get("impact_estimate")
                or f"Priority: {item['priority']}",
                instructions=item.get("instructions") or item["description"],
                source=item.get("source") or "ai:recommendation",
            )
            self.db.add(rec)
            recommendations.append(rec)

        await self.db.commit()
        for rec in recommendations:
            await self.db.refresh(rec)

        return RecommendationGenerateResponse(
            recommendations=[
                RecommendationResponse.model_validate(r) for r in recommendations
            ],
            run_id=run.id,
            scores_analyzed=summary.get("score_count", 0),
        )

    def _build_prompt(
        self,
        brand: Brand | None,
        summary: dict[str, Any],
        by_query: list[dict[str, Any]],
        keywords: list[Keyword],
        knowledge_count: int,
        content_locale: str,
    ) -> str:
        sections = []

        if brand:
            sections.extend(
                [
                    f"Brand: {brand.name}",
                    f"Website: {brand.website or 'N/A'}",
                    f"Description: {brand.description or 'N/A'}",
                    f"Industry: {brand.industry or 'N/A'}",
                    "",
                ]
            )

        sections.extend(
            [
                "Overall Scores:",
                f"  Total answers scored: {summary.get('score_count', 0)}",
                f"  Average total score: {summary.get('avg_total', 0):.1f}/100",
                f"  Average mention score: {summary.get('avg_mention', 0):.1f}/100",
                f"  Average sentiment score: {summary.get('avg_sentiment', 0):.1f}/100",
                f"  Average position score: {summary.get('avg_position', 0):.1f}/100",
                f"  Average accuracy score: {summary.get('avg_accuracy', 0):.1f}/100",
                f"  Average citation score: {summary.get('avg_citation', 0):.1f}/100",
                f"  Avg recommendation: {summary.get('avg_recommendation', 0):.1f}/100",
                f"  Min total: {summary.get('min_total', 0):.1f}, "
                f"Max total: {summary.get('max_total', 0):.1f}",
                "",
            ]
        )

        if by_query:
            # Show worst-performing queries
            sorted_queries = sorted(by_query, key=lambda q: q.get("avg_total", 0))
            sections.append("Worst-performing queries:")
            for q in sorted_queries[:10]:
                sections.append(
                    f"  - Score {q.get('avg_total', 0):.1f}: "
                    f"mention={q.get('avg_mention', 0):.0f} "
                    f"sentiment={q.get('avg_sentiment', 0):.0f} "
                    f"citation={q.get('avg_citation', 0):.0f}"
                )
            sections.append("")

        if keywords:
            sections.append(f"Tracked keywords ({len(keywords)}):")
            sections.append(", ".join(kw.keyword for kw in keywords[:30]))
            sections.append("")

        sections.append(f"Knowledge base entries: {knowledge_count}")
        sections.append("")
        sections.append(
            "Generate specific, actionable recommendations to improve AI visibility."
        )

        return "\n".join(sections)

    @staticmethod
    def _parse_json_payload(raw: str) -> Any:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        fenced = re.search(r"```(?:json)?\s*([\[{].*[\]}])\s*```", raw, re.DOTALL)
        if fenced:
            return json.loads(fenced.group(1))

        match = re.search(r"([\[{].*[\]}])", raw, re.DOTALL)
        if match:
            return json.loads(match.group(1))

        raise RecommendationServiceError(
            502, "ai.invalid_json", "The AI provider returned invalid JSON."
        )

    @staticmethod
    def _extract_recommendations(payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, dict):
            raw = payload.get("recommendations", [])
        elif isinstance(payload, list):
            raw = payload
        else:
            raw = []

        valid_categories = {"content", "seo", "brand_positioning", "technical"}
        valid_priorities = {"high", "medium", "low"}

        results: list[dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            title = item.get("title", "").strip()
            description = item.get("description", "").strip()
            if not title or not description:
                continue

            category = item.get("category", "content").lower()
            if category not in valid_categories:
                category = "content"

            priority = item.get("priority", "medium").lower()
            if priority not in valid_priorities:
                priority = "medium"

            affected = item.get("affected_keywords")
            if isinstance(affected, list):
                affected = [k for k in affected if isinstance(k, str)][:10]
            else:
                affected = None

            results.append(
                {
                    "category": category,
                    "priority": priority,
                    "title": title,
                    "description": description,
                    "affected_keywords": affected,
                }
            )
            if len(results) >= 10:
                break
        return results

    async def _verify_project(self, project_id: UUID, tenant_id: UUID) -> Project:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == tenant_id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise RecommendationServiceError(
                404, "project.not_found", "Project not found"
            )
        return project
