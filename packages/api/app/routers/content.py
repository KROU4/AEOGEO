from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_current_user,
    get_db,
    get_redis,
    get_system_admin,
)
from app.models.user import User
from app.schemas.content import (
    ContentCreate,
    ContentGenerateRequest,
    ContentResponse,
    ContentUpdate,
)
from app.services.content import ContentService
from app.services.content_audit import ContentAuditService
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.content import _to_response
from app.services.content_factory import ContentFactoryService
from app.utils.pagination import PaginatedResponse

router = APIRouter(prefix="/content", tags=["content"])


# ---------------------------------------------------------------------------
# Content Audit endpoints (must be before /{content_id}/ parametric routes)
# ---------------------------------------------------------------------------


@router.post("/audit/trigger")
async def trigger_audit(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_system_admin),
) -> dict:
    """Manually trigger content audit check (admin only).

    Finds all published content needing audit and triggers measurement runs.
    Returns a summary of what was triggered.
    """
    service = ContentAuditService(db)
    content_items = await service.find_content_needing_audit()

    if not content_items:
        return {"message": "No content items need audit at this time", "triggered": 0}

    triggered_runs: list[dict] = []
    for item in content_items:
        try:
            runs = await service.trigger_audit_run(item.id)
            await db.commit()
            triggered_runs.append({
                "content_id": str(item.id),
                "content_title": item.title,
                "run_ids": [str(r.id) for r in runs],
            })
        except Exception as e:
            triggered_runs.append({
                "content_id": str(item.id),
                "content_title": item.title,
                "error": str(e),
            })

    return {
        "message": f"Audit triggered for {len(triggered_runs)} content items",
        "triggered": len(triggered_runs),
        "details": triggered_runs,
    }


# ---------------------------------------------------------------------------
# Content CRUD endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=PaginatedResponse[ContentResponse])
async def list_content(
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    project_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[ContentResponse]:
    service = ContentService(db)
    return await service.list_content(
        user.tenant_id, cursor, limit, status, project_id
    )


@router.post("/", response_model=ContentResponse, status_code=201)
async def create_content(
    body: ContentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    result = await service.create_content(user.id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    content = await service.get_content(content_id, user.tenant_id)
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")

    return _to_response(content)


@router.put("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: UUID,
    body: ContentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    result = await service.update_content(content_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return result


@router.post("/{content_id}/submit-review", response_model=ContentResponse)
async def submit_review(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    try:
        result = await service.transition_status(
            content_id, user.tenant_id, "review"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return result


@router.post("/{content_id}/approve", response_model=ContentResponse)
async def approve(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    try:
        result = await service.transition_status(
            content_id, user.tenant_id, "published"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return result


@router.post("/{content_id}/reject", response_model=ContentResponse)
async def reject(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    try:
        result = await service.transition_status(
            content_id, user.tenant_id, "draft"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return result


@router.post("/{content_id}/archive", response_model=ContentResponse)
async def archive(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    service = ContentService(db)
    try:
        result = await service.transition_status(
            content_id, user.tenant_id, "archived"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return result


@router.post("/generate", response_model=ContentResponse, status_code=201)
async def generate(
    body: ContentGenerateRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    """Compatibility wrapper for project-scoped template-based generation."""
    ai_client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=body.project_id,
    )
    factory = ContentFactoryService(db)
    template_id = await factory.get_default_template_id_for_content_type(
        body.content_type
    )

    if template_id is None:
        raise HTTPException(
            status_code=404,
            detail="No template found for this content type",
        )

    try:
        content = await factory.generate_content(
            ai_client=ai_client,
            template_id=template_id,
            project_id=body.project_id,
            tenant_id=user.tenant_id,
            author_id=user.id,
            topic=body.topic,
        )
    except UsageLimitError:
        raise HTTPException(
            status_code=429,
            detail={"code": "ai.usage_limit_reached"},
        )
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail={"code": "ai.rate_limited"},
        )
    except NoAPIKeyError:
        raise HTTPException(
            status_code=503,
            detail={"code": "ai.no_api_key"},
        )
    except ProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "ai.provider_error", "message": str(exc)},
        )

    if content is None:
        raise HTTPException(
            status_code=404,
            detail="Template or project/brand not found",
        )

    return _to_response(content)


# ---------------------------------------------------------------------------
# Content Audit endpoints
# ---------------------------------------------------------------------------


@router.get("/{content_id}/audit")
async def get_audit_results(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get before/after visibility audit results for a content item."""
    service = ContentAuditService(db)
    result = await service.get_audit_results(content_id)
    if result.get("error") == "content_not_found":
        raise HTTPException(status_code=404, detail="Content not found")
    return result
