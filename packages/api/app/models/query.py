"""Query models — QuerySet, QueryCluster, and Query."""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class QuerySet(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "query_sets"

    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, default=None)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="query_sets")  # noqa: F821
    queries: Mapped[list["Query"]] = relationship(back_populates="query_set")
    clusters: Mapped[list["QueryCluster"]] = relationship(back_populates="query_set")

    def __repr__(self) -> str:
        return f"<QuerySet {self.name!r}>"


class QueryCluster(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "query_clusters"

    name: Mapped[str] = mapped_column(String(256))
    centroid_embedding = mapped_column(Vector(3072), nullable=True)

    query_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("query_sets.id", ondelete="CASCADE")
    )

    # -- relationships --
    query_set: Mapped["QuerySet"] = relationship(back_populates="clusters")
    queries: Mapped[list["Query"]] = relationship(back_populates="cluster")

    def __repr__(self) -> str:
        return f"<QueryCluster {self.name!r}>"


class Query(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "queries"

    text: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(64))
    priority: Mapped[int] = mapped_column(Integer, default=3)
    status: Mapped[str] = mapped_column(String(32), default="pending")

    query_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("query_sets.id", ondelete="CASCADE")
    )
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("query_clusters.id", ondelete="SET NULL"), default=None
    )

    # -- relationships --
    query_set: Mapped["QuerySet"] = relationship(back_populates="queries")
    cluster: Mapped["QueryCluster | None"] = relationship(back_populates="queries")

    def __repr__(self) -> str:
        return f"<Query {self.text[:50]!r}>"
