"""Feedback router — submit, list, stats, and delete feedback entries."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackResponse, FeedbackStats
from app.services.feedback import FeedbackService

router = APIRouter(prefix="/feedback", tags=["feedback"])


# ---------------------------------------------------------------------------
# POST /feedback — Submit feedback
# ---------------------------------------------------------------------------

@router.post("/", response_model=FeedbackResponse)
async def submit_feedback(
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FeedbackResponse:
    svc = FeedbackService(db)
    return await svc.create_feedback(user.id, body)


@router.get("/mine", response_model=FeedbackResponse | None)
async def get_my_feedback(
    entity_type: str = Query(...),
    entity_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FeedbackResponse | None:
    svc = FeedbackService(db)
    return await svc.get_my_feedback(user.id, entity_type, entity_id)


@router.delete("/mine", status_code=204)
async def clear_my_feedback(
    entity_type: str = Query(...),
    entity_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    svc = FeedbackService(db)
    await svc.clear_my_feedback(user.id, entity_type, entity_id)


# ---------------------------------------------------------------------------
# GET /feedback — List feedback
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[FeedbackResponse])
async def list_feedback(
    entity_type: str | None = Query(default=None),
    entity_id: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FeedbackResponse]:
    svc = FeedbackService(db)
    return await svc.list_feedback(
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# GET /feedback/stats — Feedback analytics
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=list[FeedbackStats])
async def feedback_stats(
    entity_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FeedbackStats]:
    svc = FeedbackService(db)
    return await svc.get_feedback_stats(entity_type=entity_type)


# ---------------------------------------------------------------------------
# DELETE /feedback/{feedback_id} — Delete feedback
# ---------------------------------------------------------------------------

@router.delete("/{feedback_id}", status_code=204)
async def delete_feedback(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    svc = FeedbackService(db)
    deleted = await svc.delete_feedback(feedback_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Feedback entry not found")
