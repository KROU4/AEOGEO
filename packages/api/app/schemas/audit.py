"""Public quick audit API schemas."""

from pydantic import BaseModel, EmailStr, Field


class QuickAuditRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2048)
    email: EmailStr | None = None
