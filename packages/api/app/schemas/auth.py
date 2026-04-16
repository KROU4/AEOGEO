from datetime import datetime

from pydantic import BaseModel, EmailStr


class BootstrapRequest(BaseModel):
    company_name: str | None = None
    name: str | None = None


class InviteRequest(BaseModel):
    email: EmailStr
    role_id: str | None = None
    project_id: str | None = None


class InviteResponse(BaseModel):
    message: str
    invitation_id: str | None = None
    email: EmailStr
    status: str


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    tenant_id: str
    permissions: list[str]
    created_at: str


class NotificationPreferences(BaseModel):
    weekly_reports: bool = True
    citation_alerts: bool = True
    competitor_movements: bool = False
    content_published: bool = True
    team_activity: bool = False


class NotificationPreferencesUpdate(BaseModel):
    weekly_reports: bool | None = None
    citation_alerts: bool | None = None
    competitor_movements: bool | None = None
    content_published: bool | None = None
    team_activity: bool | None = None


class TeamProjectMembershipResponse(BaseModel):
    project_id: str
    project_name: str
    role: str


class TeamMemberResponse(BaseModel):
    user_id: str
    email: str
    name: str
    status: str
    roles: list[str]
    projects: list[TeamProjectMembershipResponse]
    is_current_user: bool = False
    invitation_id: str | None = None
    invited_at: datetime | None = None
    invitation_expires_at: datetime | None = None
