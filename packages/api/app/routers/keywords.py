"""Keywords router — CRUD and AI generation for project keywords."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.keyword import (
    KeywordBulkCreate,
    KeywordCreate,
    KeywordGenerateRequest,
    KeywordGenerateResponse,
    KeywordResponse,
    KeywordUpdate,
)
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.keyword import KeywordService, KeywordServiceError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/projects/{project_id}/keywords",
    tags=["keywords"],
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


@router.get("", response_model=list[KeywordResponse])
async def list_keywords(
    project_id: UUID,
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[KeywordResponse]:
    service = KeywordService(db)
    try:
        return await service.list_keywords(project_id, user.tenant_id, category)
    except KeywordServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=KeywordResponse, status_code=201)
async def create_keyword(
    project_id: UUID,
    body: KeywordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KeywordResponse:
    service = KeywordService(db)
    try:
        return await service.create_keyword(project_id, user.tenant_id, body)
    except KeywordServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk", response_model=list[KeywordResponse], status_code=201)
async def bulk_create_keywords(
    project_id: UUID,
    body: KeywordBulkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[KeywordResponse]:
    service = KeywordService(db)
    try:
        return await service.bulk_create_keywords(project_id, user.tenant_id, body)
    except KeywordServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{keyword_id}", response_model=KeywordResponse)
async def update_keyword(
    project_id: UUID,
    keyword_id: UUID,
    body: KeywordUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KeywordResponse:
    service = KeywordService(db)
    try:
        result = await service.update_keyword(
            keyword_id, project_id, user.tenant_id, body
        )
    except KeywordServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return result


@router.delete("/{keyword_id}")
async def delete_keyword(
    project_id: UUID,
    keyword_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = KeywordService(db)
    try:
        deleted = await service.delete_keyword(keyword_id, project_id, user.tenant_id)
    except KeywordServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return {"message": "Keyword deleted"}


@router.post("/generate", response_model=KeywordGenerateResponse)
async def generate_keywords(
    project_id: UUID,
    body: KeywordGenerateRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> KeywordGenerateResponse:
    ai_client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    service = KeywordService(db)
    try:
        return await service.generate_keywords(
            project_id=project_id,
            tenant_id=user.tenant_id,
            ai_client=ai_client,
            max_keywords=body.max_keywords,
            categories=body.categories,
        )
    except KeywordServiceError as exc:
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
        logger.error("Keyword generation failed for project %s: %s", project_id, exc)
        await _raise_ai_http_exception(db, exc)
