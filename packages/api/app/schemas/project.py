import re
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


def _sanitize_domain(value: str | None) -> str | None:
    """Normalize a user-supplied domain into a clean hostname.

    Strips protocol, path, query, and trailing slashes.
    Returns ``None`` when the value is empty or clearly invalid.
    """
    if not value:
        return None
    raw = value.strip().rstrip("/")
    if not raw:
        return None

    # Add scheme so urlparse works on bare domains
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower().strip(".")
    if not host:
        return None

    # Basic hostname validation: at least one dot, valid chars
    if "." not in host:
        return None
    if not re.match(
        r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$",
        host,
    ):
        return None
    return host


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    client_name: str = ""
    domain: str | None = None
    content_locale: Literal["en", "ru"] = "en"

    @field_validator("domain", mode="before")
    @classmethod
    def clean_domain(cls, v: str | None) -> str | None:
        return _sanitize_domain(v)


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    client_name: str | None = None
    domain: str | None = None
    content_locale: Literal["en", "ru"] | None = None

    @field_validator("domain", mode="before")
    @classmethod
    def clean_domain(cls, v: str | None) -> str | None:
        return _sanitize_domain(v)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    client_name: str
    domain: str | None
    content_locale: str = "en"
    member_count: int = 0
    visibility_score: float | None = None
    created_at: datetime
    updated_at: datetime | None = None


class ProjectMemberAdd(BaseModel):
    user_id: UUID
    role: str = "member"


class ProjectMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    name: str
    email: str
    role: str
    joined_at: datetime | None = None
