"""Analytics integration model — encrypted credentials for GA4/Yandex."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class AnalyticsIntegration(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "analytics_integrations"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    provider: Mapped[str] = mapped_column(String(32))
    external_id: Mapped[str] = mapped_column(String(255))
    encrypted_credentials: Mapped[str] = mapped_column(String(8192))
    is_active: Mapped[bool] = mapped_column(default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(default=None)

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="analytics_integrations")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<AnalyticsIntegration {self.provider!r}"
            f" external_id={self.external_id!r}>"
        )
