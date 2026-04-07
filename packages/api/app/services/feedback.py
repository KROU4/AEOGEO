"""FeedbackService — CRUD + analytics for user feedback on any entity."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import FeedbackEntry
from app.schemas.feedback import FeedbackCreate, FeedbackResponse, FeedbackStats

logger = logging.getLogger(__name__)


class FeedbackService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create_feedback(
        self,
        user_id: UUID,
        data: FeedbackCreate,
    ) -> FeedbackResponse:
        result = await self.db.execute(
            select(FeedbackEntry).where(
                FeedbackEntry.user_id == user_id,
                FeedbackEntry.entity_type == data.entity_type,
                FeedbackEntry.entity_id == data.entity_id,
            )
        )
        entry = result.scalar_one_or_none()

        if entry is None:
            entry = FeedbackEntry(
                entity_type=data.entity_type,
                entity_id=data.entity_id,
                feedback=data.feedback,
                notes=data.notes,
                user_id=user_id,
            )
            self.db.add(entry)
        else:
            entry.feedback = data.feedback
            entry.notes = data.notes

        await self.db.commit()
        await self.db.refresh(entry)
        return FeedbackResponse.model_validate(entry)

    async def get_my_feedback(
        self,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
    ) -> FeedbackResponse | None:
        result = await self.db.execute(
            select(FeedbackEntry).where(
                FeedbackEntry.user_id == user_id,
                FeedbackEntry.entity_type == entity_type,
                FeedbackEntry.entity_id == entity_id,
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return None
        return FeedbackResponse.model_validate(entry)

    async def list_feedback(
        self,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        limit: int = 50,
    ) -> list[FeedbackResponse]:
        query = select(FeedbackEntry).order_by(FeedbackEntry.created_at.desc())

        if entity_type is not None:
            query = query.where(FeedbackEntry.entity_type == entity_type)
        if entity_id is not None:
            query = query.where(FeedbackEntry.entity_id == entity_id)

        query = query.limit(limit)

        result = await self.db.execute(query)
        rows = result.scalars().all()
        return [FeedbackResponse.model_validate(r) for r in rows]

    async def get_feedback_stats(
        self,
        entity_type: str | None = None,
    ) -> list[FeedbackStats]:
        """Count likes vs dislikes, grouped by entity_type."""
        likes_expr = func.count(
            case((FeedbackEntry.feedback == "like", 1))
        )
        dislikes_expr = func.count(
            case((FeedbackEntry.feedback == "dislike", 1))
        )

        query = select(
            FeedbackEntry.entity_type,
            likes_expr.label("total_likes"),
            dislikes_expr.label("total_dislikes"),
        ).group_by(FeedbackEntry.entity_type)

        if entity_type is not None:
            query = query.where(FeedbackEntry.entity_type == entity_type)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            FeedbackStats(
                entity_type=row.entity_type,
                total_likes=row.total_likes,
                total_dislikes=row.total_dislikes,
            )
            for row in rows
        ]

    async def delete_feedback(
        self,
        feedback_id: UUID,
    ) -> bool:
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.id == feedback_id)
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return False

        await self.db.delete(entry)
        await self.db.commit()
        return True

    async def clear_my_feedback(
        self,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
    ) -> bool:
        result = await self.db.execute(
            select(FeedbackEntry).where(
                FeedbackEntry.user_id == user_id,
                FeedbackEntry.entity_type == entity_type,
                FeedbackEntry.entity_id == entity_id,
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return False

        await self.db.delete(entry)
        await self.db.commit()
        return True
