"""VisibilityScore model — stores computed visibility metrics per answer."""

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class VisibilityScore(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "visibility_scores"

    mention_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    sentiment_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    position_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    accuracy_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    citation_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    recommendation_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    total_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)

    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE"),
        unique=True,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("engine_runs.id"))
    query_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("queries.id"))
    engine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("engines.id"))

    answer: Mapped["Answer"] = relationship(back_populates="visibility_score")  # noqa: F821

    def __repr__(self) -> str:
        return f"<VisibilityScore total={self.total_score}>"
