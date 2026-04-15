"""Pydantic schemas for site GEO audits."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SiteAuditStartRequest(BaseModel):
    """Request body for starting a site audit.

    If ``url`` is omitted, the project's brand website is used.
    """

    url: str | None = None


class SiteAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    url: str
    overall_geo_score: float
    status: str
    error_message: str | None = None
    temporal_workflow_id: str | None = None
    result_json: dict[str, Any] | None = None
    created_at: datetime


class SiteAuditListResponse(BaseModel):
    items: list[SiteAuditResponse]
