"""Recommendations router — AI-generated improvement suggestions."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.recommendation import (
    RecommendationGenerateRequest,
    RecommendationGenerateResponse,
    RecommendationPatchRequest,
    RecommendationResponse,
)
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.recommendation import (
    RecommendationService,
    RecommendationServiceError,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/projects/{project_id}/recommendations",
    tags=["recommendations"],
)


async def _raise_ai_http_exception(db: AsyncSession, exc: Exception) -> None:
    if isinstance(exc, UsageLimitError):
        raise HTTPException(
            status_code=429,
            detail={"code": "usage.limit_reached", "message": str(exc)},
        ) from exc
    if isinstance(exc, RateLimitError):
        raise HTTPException(
            status_code=429,
            detail={"code": "usage.rate_limited", "message": str(exc)},
        ) from exc
    if isinstance(exc, NoAPIKeyError):
        raise HTTPException(
            status_code=503,
            detail={"code": "ai_key.not_found", "message": str(exc)},
        ) from exc
    if isinstance(exc, ProviderError):
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail={"code": "ai.provider_error", "message": str(exc)},
        ) from exc
    raise exc


@router.get("", response_model=list[RecommendationResponse])
async def list_recommendations(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RecommendationResponse]:
    service = RecommendationService(db)
    try:
        return await service.list_recommendations(project_id, user.tenant_id)
    except RecommendationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{rec_id}", response_model=RecommendationResponse)
async def patch_recommendation(
    project_id: UUID,
    rec_id: UUID,
    body: RecommendationPatchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecommendationResponse:
    service = RecommendationService(db)
    try:
        return await service.patch_recommendation_status(
            project_id, rec_id, user.tenant_id, body.status,
        )
    except RecommendationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc


@router.post("/generate", response_model=RecommendationGenerateResponse)
async def generate_recommendations(
    project_id: UUID,
    body: RecommendationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> RecommendationGenerateResponse:
    ai_client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    service = RecommendationService(db)
    try:
        return await service.generate_recommendations(
            project_id=project_id,
            tenant_id=user.tenant_id,
            ai_client=ai_client,
            run_id=body.run_id,
        )
    except RecommendationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except (
        UsageLimitError,
        RateLimitError,
        NoAPIKeyError,
        ProviderError,
    ) as exc:
        logger.error(
            "Recommendation generation failed for project %s: %s",
            project_id,
            exc,
        )
        await _raise_ai_http_exception(db, exc)
