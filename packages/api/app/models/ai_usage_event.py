"""AI usage event model — append-only log of every AI API call."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, UUIDMixin


class AIUsageEvent(UUIDMixin, Base):
    __tablename__ = "ai_usage_events"
    __table_args__ = (
        Index("ix_ai_usage_events_tenant_created", "tenant_id", "created_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, default=None
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, default=None
    )
    provider: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(100))
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    total_tokens: Mapped[int] = mapped_column(default=0)
    cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 6), default=Decimal("0")
    )
    request_type: Mapped[str] = mapped_column(String(50))
    duration_ms: Mapped[int | None] = mapped_column(default=None)
    status: Mapped[str] = mapped_column(String(20), default="success")
    error_message: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(
        default=None, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<AIUsageEvent {self.provider}/{self.model} tenant={self.tenant_id}>"
