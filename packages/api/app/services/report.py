import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.report import Report
from app.schemas.report import (
    PublicReportResponse,
    ReportCreate,
    ReportDetailResponse,
    ReportResponse,
    ShareLinkResponse,
)
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    paginate_results,
)


def _shareable_url(token: str | None) -> str | None:
    if not token:
        return None
    return f"/shared/reports/{token}"


def _share_link_active(report: Report, now: datetime | None = None) -> bool:
    if not report.shareable_token or not report.expires_at:
        return False
    exp = report.expires_at
    cur = now if now is not None else datetime.now(UTC)
    # SQLite/tests may return naive UTC; Postgres may return aware — compare safely.
    if exp.tzinfo is None and cur.tzinfo is not None:
        cur = cur.replace(tzinfo=None)
    elif exp.tzinfo is not None and cur.tzinfo is None:
        cur = cur.replace(tzinfo=UTC)
    return exp > cur


def _to_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        project_id=report.project_id,
        created_at=report.created_at,
        shareable_url=_shareable_url(report.shareable_token)
        if _share_link_active(report)
        else None,
    )


def _to_detail_response(report: Report) -> ReportDetailResponse:
    summary = _to_response(report)
    return ReportDetailResponse(
        **summary.model_dump(),
        data=report.data_json,
    )


def _to_public_response(report: Report) -> PublicReportResponse:
    return PublicReportResponse(
        title=report.title,
        report_type=report.report_type,
        created_at=report.created_at,
        data=report.data_json,
    )


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_reports(
        self,
        tenant_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
        project_id: UUID | None = None,
    ) -> PaginatedResponse[ReportResponse]:
        query = (
            select(Report)
            .join(Project, Report.project_id == Project.id)
            .where(Project.tenant_id == tenant_id)
        )

        if project_id:
            query = query.where(Report.project_id == project_id)

        query = apply_cursor_pagination(query, Report, cursor, limit)

        result = await self.db.execute(query)
        rows = list(result.scalars().all())

        items, next_cursor, has_more = paginate_results(rows, limit)
        return PaginatedResponse(
            items=[_to_response(r) for r in items],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    async def create_report(
        self,
        tenant_id: UUID,
        data: ReportCreate,
    ) -> ReportResponse | None:
        # Verify project belongs to tenant
        result = await self.db.execute(
            select(Project).where(
                Project.id == data.project_id, Project.tenant_id == tenant_id
            )
        )
        if result.scalar_one_or_none() is None:
            return None

        title = data.title or f"{data.report_type.replace('_', ' ').title()} Report"
        report = Report(
            title=title,
            report_type=data.report_type,
            project_id=data.project_id,
            data_json={"date_range": data.date_range},
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)

        return _to_response(report)

    async def get_report(self, report_id: UUID, tenant_id: UUID) -> Report | None:
        result = await self.db.execute(
            select(Report)
            .join(Project, Report.project_id == Project.id)
            .where(Report.id == report_id, Project.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def delete_report(self, report_id: UUID, tenant_id: UUID) -> bool:
        report = await self.get_report(report_id, tenant_id)
        if report is None:
            return False

        await self.db.delete(report)
        await self.db.commit()
        return True

    async def get_share_link(
        self, report_id: UUID, tenant_id: UUID
    ) -> ShareLinkResponse | None:
        report = await self.get_report(report_id, tenant_id)
        if report is None:
            return None

        if not _share_link_active(report):
            return None

        return ShareLinkResponse(
            url=_shareable_url(report.shareable_token) or "",
            expires_at=report.expires_at,
        )

    async def create_share_link(
        self, report_id: UUID, tenant_id: UUID, expires_in_days: int = 30
    ) -> ShareLinkResponse | None:
        report = await self.get_report(report_id, tenant_id)
        if report is None:
            return None

        report.shareable_token = secrets.token_urlsafe(32)
        report.expires_at = datetime.now(UTC) + timedelta(days=expires_in_days)

        await self.db.commit()
        await self.db.refresh(report)

        return ShareLinkResponse(
            url=_shareable_url(report.shareable_token) or "",
            expires_at=report.expires_at,
        )

    async def get_shared_report(self, share_token: str) -> PublicReportResponse | None:
        result = await self.db.execute(
            select(Report).where(Report.shareable_token == share_token)
        )
        report = result.scalar_one_or_none()
        if report is None or not _share_link_active(report):
            return None

        return _to_public_response(report)
