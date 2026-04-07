from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.report import (
    ReportCreate,
    ReportDetailResponse,
    ReportGenerate,
    ReportResponse,
    ShareLinkResponse,
)
from app.services.report import ReportService, _to_detail_response
from app.services.report_generator import ReportGeneratorService
from app.utils.pagination import PaginatedResponse

router = APIRouter(prefix="/reports", tags=["reports"])

# Separate router for project-scoped report generation
generate_router = APIRouter(
    prefix="/projects/{project_id}/reports",
    tags=["reports"],
)


# ---------------------------------------------------------------------------
# Report generation (from pipeline data)
# ---------------------------------------------------------------------------


@generate_router.post("/generate", response_model=ReportResponse, status_code=201)
async def generate_report(
    project_id: UUID,
    body: ReportGenerate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportResponse:
    """Auto-generate a report from pipeline data."""
    generator = ReportGeneratorService(db)

    valid_types = ("visibility_audit", "competitive_analysis", "content_performance")
    if body.report_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report_type. Must be one of: {', '.join(valid_types)}",
        )

    try:
        if body.report_type == "visibility_audit":
            report = await generator.generate_visibility_audit(
                project_id, user.tenant_id, body.run_id
            )
        elif body.report_type == "competitive_analysis":
            report = await generator.generate_competitive_analysis(
                project_id, user.tenant_id, body.run_id
            )
        else:
            report = await generator.generate_content_performance(
                project_id, user.tenant_id
            )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    from app.services.report import _to_response

    return _to_response(report)


# ---------------------------------------------------------------------------
# Standard CRUD
# ---------------------------------------------------------------------------


@router.get("/", response_model=PaginatedResponse[ReportResponse])
async def list_reports(
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    project_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[ReportResponse]:
    service = ReportService(db)
    return await service.list_reports(user.tenant_id, cursor, limit, project_id)


@router.post("/", response_model=ReportResponse, status_code=201)
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportResponse:
    service = ReportService(db)
    result = await service.create_report(user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.get("/{report_id}", response_model=ReportDetailResponse)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportDetailResponse:
    service = ReportService(db)
    report = await service.get_report(report_id, user.tenant_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    return _to_detail_response(report)


@router.delete("/{report_id}")
async def delete_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = ReportService(db)
    deleted = await service.delete_report(report_id, user.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted"}


@router.get("/{report_id}/share", response_model=ShareLinkResponse)
async def get_share_link(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareLinkResponse:
    service = ReportService(db)
    result = await service.get_share_link(report_id, user.tenant_id)
    if result is None:
        raise HTTPException(
            status_code=404, detail="Report not found or no share link exists"
        )
    return result


@router.post("/{report_id}/share", response_model=ShareLinkResponse)
async def create_share_link(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareLinkResponse:
    service = ReportService(db)
    result = await service.create_share_link(report_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return result

