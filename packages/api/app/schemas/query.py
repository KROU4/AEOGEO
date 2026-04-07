from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class QuerySetCreate(BaseModel):
    name: str
    description: str | None = None


class QuerySetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class QuerySetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    project_id: UUID
    query_count: int
    created_at: datetime
    updated_at: datetime | None = None


class QueryCreate(BaseModel):
    text: str
    category: str
    priority: int = 3


class QueryUpdate(BaseModel):
    text: str | None = None
    category: str | None = None
    priority: int | None = None
    status: str | None = None


class QueryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    category: str
    priority: int
    status: str
    query_set_id: UUID
    cluster_id: UUID | None = None
    created_at: datetime


class QueryGenerateRequest(BaseModel):
    count: int = 50


class BatchQueryStatusUpdate(BaseModel):
    query_ids: list[UUID]
    status: str


class QueryClusterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    query_count: int
    query_set_id: UUID
