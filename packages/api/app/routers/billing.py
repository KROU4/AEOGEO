"""Billing plan (Stripe integration later)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.services.ai_usage import AIUsageService

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plan")
async def get_billing_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant))
        .where(User.id == user.id)
    )
    u = result.scalar_one()
    tenant = u.tenant
    qs = await AIUsageService(db).get_current_month_quota_status(user.tenant_id)
    return {
        "plan": tenant.plan if tenant else "free",
        "quota": {
            "tokens_used": qs.tokens_used,
            "tokens_limit": qs.tokens_limit,
            "tokens_pct": qs.tokens_pct,
            "cost_used": float(qs.cost_used),
            "cost_limit": float(qs.cost_limit) if qs.cost_limit else None,
            "cost_pct": qs.cost_pct,
            "requests_today": qs.requests_today,
            "requests_day_limit": qs.requests_day_limit,
            "requests_this_month": qs.requests_this_month,
            "warning_threshold_pct": qs.warning_threshold_pct,
            "warning_active": qs.warning_active,
            "limit_reached": qs.limit_reached,
        },
    }
