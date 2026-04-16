from __future__ import annotations

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from redis.asyncio import Redis

from app.config import Settings
from app.dependencies import get_redis, get_settings

router = APIRouter(prefix="/referral", tags=["referral"])


class ReferralTrackRequest(BaseModel):
    email: EmailStr
    referral_code: str | None = None
    provider: str = "tolt"
    source: str | None = None


@router.post("/track")
async def track_referral_signup(
    body: ReferralTrackRequest,
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings),
) -> dict:
    key = f"referral:signup:{body.provider}:{body.email}"
    payload = {
        "email": body.email,
        "referral_code": body.referral_code,
        "provider": body.provider,
        "source": body.source,
        "tracked_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis.set(key, str(payload))

    if settings.referral_track_webhook_url:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(settings.referral_track_webhook_url, json=payload)

    return {"ok": True}
