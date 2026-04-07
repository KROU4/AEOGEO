"""Tenant quota model — per-organization usage limits."""

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class TenantQuota(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tenant_quotas"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id"), unique=True
    )
    monthly_token_budget: Mapped[int | None] = mapped_column(default=None)
    monthly_cost_budget_usd: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), default=None
    )
    requests_per_minute: Mapped[int | None] = mapped_column(default=None)
    requests_per_day: Mapped[int | None] = mapped_column(default=None)
    warning_threshold_pct: Mapped[int] = mapped_column(default=80)
    is_active: Mapped[bool] = mapped_column(default=True)

    # -- relationships --
    tenant: Mapped["Tenant"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<TenantQuota tenant={self.tenant_id}>"
