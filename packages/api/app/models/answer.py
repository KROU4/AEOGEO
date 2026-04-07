"""Answer model — stores a single AI engine response to a query."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Answer(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "answers"

    sample_index: Mapped[int] = mapped_column(Integer)
    raw_response: Mapped[str] = mapped_column(Text)
    query_text: Mapped[str] = mapped_column(Text)
    engine_name: Mapped[str] = mapped_column(String(128))
    engine_provider: Mapped[str] = mapped_column(String(128))
    response_metadata: Mapped[dict | None] = mapped_column(JSON, default=None)
    parse_status: Mapped[str] = mapped_column(String(32), default="pending")
    parse_error: Mapped[str | None] = mapped_column(Text, default=None)
    parse_fingerprint: Mapped[str | None] = mapped_column(String(64), default=None)
    parsed_at: Mapped[datetime | None] = mapped_column(default=None)
    score_status: Mapped[str] = mapped_column(String(32), default="pending")
    score_error: Mapped[str | None] = mapped_column(Text, default=None)
    scored_at: Mapped[datetime | None] = mapped_column(default=None)

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engine_runs.id", ondelete="CASCADE")
    )
    query_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("queries.id"))
    engine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("engines.id"))

    # -- relationships --
    run: Mapped["EngineRun"] = relationship(back_populates="answers")  # noqa: F821
    query: Mapped["Query"] = relationship()  # noqa: F821
    engine: Mapped["Engine"] = relationship()  # noqa: F821
    mentions: Mapped[list["Mention"]] = relationship(back_populates="answer")  # noqa: F821
    citations: Mapped[list["Citation"]] = relationship(back_populates="answer")  # noqa: F821
    visibility_score: Mapped["VisibilityScore | None"] = relationship(  # noqa: F821
        back_populates="answer",
        uselist=False,
    )

    def __repr__(self) -> str:
        return f"<Answer sample={self.sample_index}>"
