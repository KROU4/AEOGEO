"""Lead-gen public GEO quick audit records."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .user import User


class PublicAudit(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "public_audits"

    url: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    geo_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    linked_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ip_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    linked_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[linked_user_id],
    )
