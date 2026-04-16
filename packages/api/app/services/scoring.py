"""Scoring service — computes 6-dimension visibility scores for AI answers.

Scores each answer on mention, sentiment, position, accuracy, citation,
and recommendation axes (0-10 scale), then aggregates per-run, per-engine,
and per-query summaries.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.answer import Answer
from app.models.citation import Citation
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.visibility_score import VisibilityScore
logger = logging.getLogger(__name__)

# Default scoring weights (equal 1/6 each)
DEFAULT_WEIGHTS = {
    "mention": 1.0,
    "sentiment": 1.0,
    "position": 1.0,
    "accuracy": 1.0,
    "citation": 1.0,
    "recommendation": 1.0,
}


def _to_float(val: Decimal | float | int | None) -> float:
    """Safely convert a Numeric/Decimal value to float."""
    if val is None:
        return 0.0
    return float(val)


class ScoringService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Score computation for a single answer
    # ------------------------------------------------------------------

    async def score_answer(self, answer_id: UUID) -> VisibilityScore:
        """Compute 6 sub-scores (0-10) for a single answer and persist a VisibilityScore."""

        # Load the answer with its mentions and citations
        result = await self.db.execute(
            select(Answer)
            .where(Answer.id == answer_id)
            .options(
                selectinload(Answer.mentions),
                selectinload(Answer.citations),
            )
        )
        answer = result.scalar_one()

        brand_mentions = [
            m for m in answer.mentions if m.entity_type == "brand"
        ]

        mention = self._compute_mention_score(brand_mentions)
        sentiment = self._compute_sentiment_score(brand_mentions)
        position = self._compute_position_score(brand_mentions)
        accuracy = await self._compute_accuracy_score(answer)
        citation = self._compute_citation_score(list(answer.citations))
        recommendation = self._compute_recommendation_score(answer.mentions)

        total = self._compute_total_score(
            mention, sentiment, position, accuracy, citation, recommendation
        )

        existing_result = await self.db.execute(
            select(VisibilityScore).where(VisibilityScore.answer_id == answer_id)
        )
        score = existing_result.scalar_one_or_none()
        if score is None:
            score = VisibilityScore(
                answer_id=answer.id,
                run_id=answer.run_id,
                query_id=answer.query_id,
                engine_id=answer.engine_id,
            )
            self.db.add(score)

        score.mention_score = Decimal(str(round(mention, 2)))
        score.sentiment_score = Decimal(str(round(sentiment, 2)))
        score.position_score = Decimal(str(round(position, 2)))
        score.accuracy_score = Decimal(str(round(accuracy, 2)))
        score.citation_score = Decimal(str(round(citation, 2)))
        score.recommendation_score = Decimal(str(round(recommendation, 2)))
        score.total_score = Decimal(str(round(total, 2)))

        answer.score_status = "completed"
        answer.score_error = None
        answer.scored_at = datetime.now(UTC)

        await self.db.flush()

        logger.info(
            "Scored answer %s: total=%.2f (m=%.1f s=%.1f p=%.1f a=%.1f c=%.1f r=%.1f)",
            answer_id,
            total,
            mention,
            sentiment,
            position,
            accuracy,
            citation,
            recommendation,
        )

        return score

    # ------------------------------------------------------------------
    # Sub-score calculations
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_mention_score(brand_mentions: list[Mention]) -> float:
        """Mention score: 0-10 based on presence and position of brand mentions."""
        if not brand_mentions:
            return 0.0

        count = len(brand_mentions)
        if count == 1:
            m = brand_mentions[0]
            pos = m.position_in_answer
            if pos is not None and pos == 1:
                return 8.0
            return 5.0

        # Multiple mentions — base 10, weighted slightly by position
        first_pos = min(
            (m.position_in_answer for m in brand_mentions if m.position_in_answer is not None),
            default=None,
        )
        if first_pos is not None and first_pos == 1:
            return 10.0
        return 10.0  # Multiple mentions regardless = 10

    @staticmethod
    def _compute_sentiment_score(brand_mentions: list[Mention]) -> float:
        """Sentiment score: average of brand mention sentiments mapped to 0-10."""
        if not brand_mentions:
            return 0.0

        sentiment_map = {
            "positive": 10.0,
            "neutral": 5.0,
            "negative": 0.0,
        }

        values = [
            sentiment_map.get(m.sentiment, 5.0) for m in brand_mentions
        ]
        return sum(values) / len(values)

    @staticmethod
    def _compute_position_score(brand_mentions: list[Mention]) -> float:
        """Position score: based on position_in_answer of first brand mention."""
        if not brand_mentions:
            return 0.0

        positions = [
            m.position_in_answer
            for m in brand_mentions
            if m.position_in_answer is not None
        ]
        if not positions:
            return 0.0

        first_position = min(positions)
        if first_position == 1:
            return 10.0
        elif first_position == 2:
            return 8.0
        elif first_position == 3:
            return 6.0
        else:
            return 3.0

    async def _compute_accuracy_score(self, answer: Answer) -> float:
        """Neutral accuracy score (knowledge-base similarity removed from product scope)."""
        return 5.0

    @staticmethod
    def _compute_citation_score(citations: list[Citation]) -> float:
        """Citation score: 10 if client source cited, 5 if any citation, 0 if none."""
        if not citations:
            return 0.0

        has_client = any(c.is_client_source for c in citations)
        if has_client:
            return 10.0

        return 5.0

    @staticmethod
    def _compute_recommendation_score(mentions: list[Mention]) -> float:
        """Recommendation score: 10 if explicitly recommended, 5 if favorable, 0 otherwise."""
        if not mentions:
            return 0.0

        has_recommended = any(m.is_recommended for m in mentions)
        if has_recommended:
            return 10.0

        # Check for favorable mentions (positive sentiment brand mentions)
        has_favorable = any(
            m.entity_type == "brand" and m.sentiment == "positive"
            for m in mentions
        )
        if has_favorable:
            return 5.0

        return 0.0

    @staticmethod
    def _compute_total_score(
        mention: float,
        sentiment: float,
        position: float,
        accuracy: float,
        citation: float,
        recommendation: float,
        weights: dict[str, float] | None = None,
    ) -> float:
        """Weighted average of all 6 sub-scores. Default: equal weights."""
        w = weights or DEFAULT_WEIGHTS
        scores = {
            "mention": mention,
            "sentiment": sentiment,
            "position": position,
            "accuracy": accuracy,
            "citation": citation,
            "recommendation": recommendation,
        }
        total_weight = sum(w.values())
        if total_weight == 0:
            return 0.0

        weighted_sum = sum(scores[k] * w[k] for k in scores)
        return weighted_sum / total_weight

    # ------------------------------------------------------------------
    # Batch scoring
    # ------------------------------------------------------------------

    async def score_run(self, run_id: UUID) -> dict:
        """Score all unscored answers for a given run.

        Returns: {total_scored: int, avg_total_score: float}
        """
        # Find all answers for this run
        answers_result = await self.db.execute(
            select(Answer).where(Answer.run_id == run_id)
        )
        all_answers = list(answers_result.scalars().all())

        if not all_answers:
            return {"total_scored": 0, "avg_total_score": 0.0}

        # Only score answers with completed parsing. Failed/pending parse stages
        # remain eligible for later retries instead of producing misleading scores.
        scoreable = [
            a for a in all_answers
            if a.parse_status == "completed" and a.score_status != "completed"
        ]

        scored_count = 0
        total_scores: list[float] = []
        errors = 0
        run = await self.db.get(EngineRun, run_id)
        already_completed = sum(1 for a in all_answers if a.score_status == "completed")

        for answer in scoreable:
            try:
                score = await self.score_answer(answer.id)
                scored_count += 1
                total_scores.append(_to_float(score.total_score))
            except Exception as exc:
                answer.score_status = "failed"
                answer.score_error = str(exc)[:2000]
                logger.exception("Failed to score answer %s", answer.id)
                errors += 1
            if run is not None:
                run.score_completed = already_completed + scored_count
            await self.db.flush()

        await self.db.commit()

        avg = sum(total_scores) / len(total_scores) if total_scores else 0.0

        logger.info(
            "Scored run %s: %d answers, avg_total=%.2f",
            run_id,
            scored_count,
            avg,
        )

        return {
            "total_scored": scored_count,
            "avg_total_score": round(avg, 2),
            "errors": errors,
            "eligible_answers": len(scoreable),
        }

    # ------------------------------------------------------------------
    # Aggregation queries
    # ------------------------------------------------------------------

    async def get_run_summary(self, run_id: UUID) -> dict:
        """Get aggregated score summary for a pipeline run."""
        result = await self.db.execute(
            select(
                func.count().label("count"),
                func.avg(VisibilityScore.total_score).label("avg_total"),
                func.avg(VisibilityScore.mention_score).label("avg_mention"),
                func.avg(VisibilityScore.sentiment_score).label("avg_sentiment"),
                func.avg(VisibilityScore.position_score).label("avg_position"),
                func.avg(VisibilityScore.accuracy_score).label("avg_accuracy"),
                func.avg(VisibilityScore.citation_score).label("avg_citation"),
                func.avg(VisibilityScore.recommendation_score).label("avg_recommendation"),
                func.min(VisibilityScore.total_score).label("min_total"),
                func.max(VisibilityScore.total_score).label("max_total"),
            ).where(VisibilityScore.run_id == run_id)
        )
        row = result.one()

        return {
            "run_id": str(run_id),
            "score_count": row.count,
            "avg_total": round(_to_float(row.avg_total), 2),
            "avg_mention": round(_to_float(row.avg_mention), 2),
            "avg_sentiment": round(_to_float(row.avg_sentiment), 2),
            "avg_position": round(_to_float(row.avg_position), 2),
            "avg_accuracy": round(_to_float(row.avg_accuracy), 2),
            "avg_citation": round(_to_float(row.avg_citation), 2),
            "avg_recommendation": round(_to_float(row.avg_recommendation), 2),
            "min_total": round(_to_float(row.min_total), 2),
            "max_total": round(_to_float(row.max_total), 2),
        }

    async def get_scores_by_engine(self, project_id: UUID) -> list[dict]:
        """Get average scores grouped by engine for a project's latest runs."""
        result = await self.db.execute(
            select(
                VisibilityScore.engine_id,
                func.count().label("count"),
                func.avg(VisibilityScore.total_score).label("avg_total"),
                func.avg(VisibilityScore.mention_score).label("avg_mention"),
                func.avg(VisibilityScore.sentiment_score).label("avg_sentiment"),
                func.avg(VisibilityScore.position_score).label("avg_position"),
                func.avg(VisibilityScore.accuracy_score).label("avg_accuracy"),
                func.avg(VisibilityScore.citation_score).label("avg_citation"),
                func.avg(VisibilityScore.recommendation_score).label("avg_recommendation"),
            )
            .join(EngineRun, EngineRun.id == VisibilityScore.run_id)
            .where(EngineRun.project_id == project_id)
            .group_by(VisibilityScore.engine_id)
        )
        rows = result.all()

        return [
            {
                "engine_id": str(row.engine_id),
                "score_count": row.count,
                "avg_total": round(_to_float(row.avg_total), 2),
                "avg_mention": round(_to_float(row.avg_mention), 2),
                "avg_sentiment": round(_to_float(row.avg_sentiment), 2),
                "avg_position": round(_to_float(row.avg_position), 2),
                "avg_accuracy": round(_to_float(row.avg_accuracy), 2),
                "avg_citation": round(_to_float(row.avg_citation), 2),
                "avg_recommendation": round(_to_float(row.avg_recommendation), 2),
            }
            for row in rows
        ]

    async def get_scores_by_query(self, run_id: UUID) -> list[dict]:
        """Get average scores grouped by query for a given run."""
        result = await self.db.execute(
            select(
                VisibilityScore.query_id,
                func.count().label("count"),
                func.avg(VisibilityScore.total_score).label("avg_total"),
                func.avg(VisibilityScore.mention_score).label("avg_mention"),
                func.avg(VisibilityScore.sentiment_score).label("avg_sentiment"),
                func.avg(VisibilityScore.position_score).label("avg_position"),
                func.avg(VisibilityScore.accuracy_score).label("avg_accuracy"),
                func.avg(VisibilityScore.citation_score).label("avg_citation"),
                func.avg(VisibilityScore.recommendation_score).label("avg_recommendation"),
            )
            .where(VisibilityScore.run_id == run_id)
            .group_by(VisibilityScore.query_id)
        )
        rows = result.all()

        return [
            {
                "query_id": str(row.query_id),
                "score_count": row.count,
                "avg_total": round(_to_float(row.avg_total), 2),
                "avg_mention": round(_to_float(row.avg_mention), 2),
                "avg_sentiment": round(_to_float(row.avg_sentiment), 2),
                "avg_position": round(_to_float(row.avg_position), 2),
                "avg_accuracy": round(_to_float(row.avg_accuracy), 2),
                "avg_citation": round(_to_float(row.avg_citation), 2),
                "avg_recommendation": round(_to_float(row.avg_recommendation), 2),
            }
            for row in rows
        ]

    async def get_score_trends(
        self, project_id: UUID, limit: int = 10
    ) -> list[dict]:
        """Get score trends across the last N runs for a project.

        Returns one entry per run, ordered by run created_at descending.
        """
        # Find recent runs for this project
        runs_result = await self.db.execute(
            select(EngineRun.id, EngineRun.created_at, EngineRun.status)
            .where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
            )
            .order_by(EngineRun.created_at.desc())
            .limit(limit)
        )
        runs = runs_result.all()

        if not runs:
            return []

        run_ids = [r.id for r in runs]

        # Get aggregated scores per run
        scores_result = await self.db.execute(
            select(
                VisibilityScore.run_id,
                func.count().label("count"),
                func.avg(VisibilityScore.total_score).label("avg_total"),
                func.avg(VisibilityScore.mention_score).label("avg_mention"),
                func.avg(VisibilityScore.sentiment_score).label("avg_sentiment"),
                func.avg(VisibilityScore.position_score).label("avg_position"),
                func.avg(VisibilityScore.accuracy_score).label("avg_accuracy"),
                func.avg(VisibilityScore.citation_score).label("avg_citation"),
                func.avg(VisibilityScore.recommendation_score).label("avg_recommendation"),
            )
            .where(VisibilityScore.run_id.in_(run_ids))
            .group_by(VisibilityScore.run_id)
        )
        score_map = {row.run_id: row for row in scores_result.all()}

        trends = []
        for run in runs:
            row = score_map.get(run.id)
            if row is None:
                continue
            trends.append(
                {
                    "run_id": str(run.id),
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                    "score_count": row.count,
                    "avg_total": round(_to_float(row.avg_total), 2),
                    "avg_mention": round(_to_float(row.avg_mention), 2),
                    "avg_sentiment": round(_to_float(row.avg_sentiment), 2),
                    "avg_position": round(_to_float(row.avg_position), 2),
                    "avg_accuracy": round(_to_float(row.avg_accuracy), 2),
                    "avg_citation": round(_to_float(row.avg_citation), 2),
                    "avg_recommendation": round(_to_float(row.avg_recommendation), 2),
                }
            )

        return trends
