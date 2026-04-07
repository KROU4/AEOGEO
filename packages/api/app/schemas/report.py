from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportCreate(BaseModel):
    project_id: UUID
    report_type: str
    title: str = ""
    date_range: str = "30d"


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    report_type: str
    project_id: UUID
    created_at: datetime
    shareable_url: str | None = None


class ReportDetailResponse(ReportResponse):
    data: dict[str, Any] | None = None


class ReportGenerate(BaseModel):
    report_type: str  # visibility_audit | competitive_analysis | content_performance
    run_id: UUID | None = None


class ShareLinkResponse(BaseModel):
    url: str
    expires_at: datetime


class PublicReportResponse(BaseModel):
    title: str
    report_type: str
    created_at: datetime
    data: dict[str, Any] | None = None
