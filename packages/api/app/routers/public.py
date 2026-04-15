"""Public API endpoints — no authentication required (shared reports)."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.report import PublicReportResponse
from app.services.report import ReportService

router = APIRouter(prefix="/public", tags=["public"])


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
