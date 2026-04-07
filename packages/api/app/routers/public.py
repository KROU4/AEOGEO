"""Public API endpoints — no authentication required.

These endpoints use embed tokens as credentials and are designed
to be called from client websites where the widget is embedded.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_redis
from app.schemas.report import PublicReportResponse
from app.schemas.widget import WidgetContentResponse, WidgetEventCreate
from app.services.report import ReportService
from app.services.widget import WidgetService

router = APIRouter(prefix="/public", tags=["public"])

# Rate limit: 60 requests per minute per embed_token
RATE_LIMIT_MAX = 60
RATE_LIMIT_WINDOW_SECONDS = 60


async def _check_widget_rate_limit(
    embed_token: str, redis: Redis
) -> tuple[bool, int]:
    """Check if the embed_token has exceeded its rate limit.

    Returns (is_allowed, remaining_requests).
    """
    now = datetime.now(timezone.utc)
    key = f"wrl:{embed_token}:{now.strftime('%Y%m%d%H%M')}"

    count_raw = await redis.get(key)
    count = int(count_raw) if count_raw is not None else 0

    if count >= RATE_LIMIT_MAX:
        return False, 0

    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, RATE_LIMIT_WINDOW_SECONDS + 10)  # Small buffer over the window
    await pipe.execute()

    return True, RATE_LIMIT_MAX - count - 1


@router.get(
    "/widgets/{embed_token}/content",
    response_model=WidgetContentResponse,
)
async def get_widget_content(
    embed_token: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Public widget content endpoint.

    Delivers published content for a widget identified by its embed_token.
    No authentication required — the embed_token itself acts as a credential.
    Rate-limited to 60 requests per minute per embed_token.
    """
    # Rate limit check
    is_allowed, remaining = await _check_widget_rate_limit(embed_token, redis)
    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again in one minute.",
        )

    service = WidgetService(db)
    result = await service.get_widget_content(embed_token)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Widget not found or inactive.",
        )

    # Return with permissive CORS and rate limit headers
    response = JSONResponse(
        content=result.model_dump(mode="json"),
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "X-RateLimit-Limit": str(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": str(remaining),
            "Cache-Control": "public, max-age=60",
        },
    )
    return response


@router.post("/widgets/{embed_token}/events", status_code=202)
async def track_widget_event(
    embed_token: str,
    body: WidgetEventCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    is_allowed, remaining = await _check_widget_rate_limit(embed_token, redis)
    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again in one minute.",
        )

    service = WidgetService(db)

    try:
        tracked = await service.track_widget_event(embed_token, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not tracked:
        raise HTTPException(
            status_code=404,
            detail="Widget not found or inactive.",
        )

    return JSONResponse(
        status_code=202,
        content={"status": "accepted"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "X-RateLimit-Limit": str(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": str(remaining),
            "Cache-Control": "no-store",
        },
    )


@router.get("/reports/{share_token}", response_model=PublicReportResponse)
async def get_shared_report(
    share_token: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    service = ReportService(db)
    result = await service.get_shared_report(share_token)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found or expired.",
        )

    return JSONResponse(
        content=result.model_dump(mode="json"),
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "public, max-age=60",
        },
    )
