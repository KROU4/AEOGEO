"""AI proxy endpoint — routes completion requests through the AIClient."""

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.ai import CompletionRequest, CompletionResponse
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
)


@router.post("/complete", response_model=CompletionResponse)
async def complete(
    body: CompletionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=body.project_id,
    )

    try:
        result = await client.complete(
            provider=body.provider,
            model=body.model,
            messages=body.messages,
            request_type=body.request_type,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        )
        await db.commit()
        return CompletionResponse(
            content=result.content,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            model=result.model,
            provider=result.provider,
        )

    except UsageLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "usage.limit_reached"},
        )
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "usage.rate_limited"},
        )
    except NoAPIKeyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ai_key.not_found"},
        )
    except ProviderError as e:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "ai.provider_error", "message": str(e)},
        )
