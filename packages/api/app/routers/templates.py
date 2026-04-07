"""Content template CRUD + content generation endpoint."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.content import ContentResponse
from app.schemas.content_template import (
    ContentTemplateGenerateRequest,
    ContentTemplateCreate,
    ContentTemplateResponse,
    ContentTemplateUpdate,
)
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.content import _to_response
from app.services.content_factory import ContentFactoryService

router = APIRouter(tags=["content-templates"])


# ------------------------------------------------------------------
# Template CRUD — /api/v1/content-templates/
# ------------------------------------------------------------------


@router.get(
    "/content-templates/",
    response_model=list[ContentTemplateResponse],
)
async def list_templates(
    content_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContentTemplateResponse]:
    service = ContentFactoryService(db)
    return await service.list_templates(content_type)


@router.post(
    "/content-templates/",
    response_model=ContentTemplateResponse,
    status_code=201,
)
async def create_template(
    body: ContentTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentTemplateResponse:
    service = ContentFactoryService(db)
    return await service.create_template(body)


@router.get(
    "/content-templates/{template_id}",
    response_model=ContentTemplateResponse,
)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentTemplateResponse:
    service = ContentFactoryService(db)
    result = await service.get_template(template_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.put(
    "/content-templates/{template_id}",
    response_model=ContentTemplateResponse,
)
async def update_template(
    template_id: UUID,
    body: ContentTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentTemplateResponse:
    service = ContentFactoryService(db)
    result = await service.update_template(template_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.delete(
    "/content-templates/{template_id}",
    status_code=204,
)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    service = ContentFactoryService(db)
    deleted = await service.delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")


# ------------------------------------------------------------------
# Content Generation — /api/v1/projects/{pid}/content/generate
# ------------------------------------------------------------------


@router.post(
    "/projects/{project_id}/content/generate",
    response_model=ContentResponse,
    status_code=201,
)
async def generate_content(
    project_id: UUID,
    body: ContentTemplateGenerateRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> ContentResponse:
    """Generate content from a template, grounded in the project's knowledge pack."""
    ai_client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    factory = ContentFactoryService(db)

    try:
        content = await factory.generate_content(
            ai_client=ai_client,
            template_id=body.template_id,
            project_id=project_id,
            tenant_id=user.tenant_id,
            author_id=user.id,
            topic=body.topic,
            extra_context=body.extra_context,
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
