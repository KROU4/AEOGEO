"""Project and ProjectMember models."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Project(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    client_name: Mapped[str | None] = mapped_column(String(255), default=None)
    domain: Mapped[str | None] = mapped_column(String(512), default=None)
    content_locale: Mapped[str] = mapped_column(
        String(8), default="en", server_default="en"
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))

    # -- relationships --
    tenant: Mapped["Tenant"] = relationship(back_populates="projects")  # noqa: F821
    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project")
    content: Mapped[list["Content"]] = relationship(back_populates="project")  # noqa: F821
    reports: Mapped[list["Report"]] = relationship(back_populates="project")  # noqa: F821
    widgets: Mapped[list["Widget"]] = relationship(back_populates="project")  # noqa: F821
    project_engines: Mapped[list["ProjectEngine"]] = relationship(  # noqa: F821
        back_populates="project"
    )
    brand: Mapped["Brand | None"] = relationship(  # noqa: F821
        back_populates="project", uselist=False
    )
    query_sets: Mapped[list["QuerySet"]] = relationship(back_populates="project")  # noqa: F821
    keywords: Mapped[list["Keyword"]] = relationship(back_populates="project")  # noqa: F821
    recommendations: Mapped[list["Recommendation"]] = relationship(  # noqa: F821
        back_populates="project"
    )
    analytics_integrations: Mapped[list["AnalyticsIntegration"]] = relationship(  # noqa: F821
        back_populates="project"
    )
    traffic_snapshots: Mapped[list["TrafficSnapshot"]] = relationship(  # noqa: F821
        back_populates="project"
    )

    def __repr__(self) -> str:
        return f"<Project {self.name!r}>"


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(64), default="member")

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="project_memberships")  # noqa: F821
