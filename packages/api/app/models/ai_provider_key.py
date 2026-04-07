"""AI provider API key model — stores encrypted keys for OpenAI, Anthropic, etc."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class AIProviderKey(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_provider_keys"

    provider: Mapped[str] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(255))
    encrypted_api_key: Mapped[str] = mapped_column(String(2048))
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, default=None
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(default=None)
    last_rotated_at: Mapped[datetime | None] = mapped_column(default=None)

    # -- relationships --
    tenant: Mapped["Tenant | None"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<AIProviderKey {self.provider!r} label={self.label!r}>"
