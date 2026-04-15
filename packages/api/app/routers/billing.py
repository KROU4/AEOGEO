"""Billing plan stub (Stripe integration later)."""

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plan")
async def get_billing_plan(_user: User = Depends(get_current_user)) -> dict:
    return {
        "plan": "free",
        "usage": {
            "projects": 1,
            "ai_requests_month": 0,
        },
    }
