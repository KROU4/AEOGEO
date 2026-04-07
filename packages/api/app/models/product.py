"""Product model — represents a product belonging to a brand."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Product(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    features: Mapped[dict | None] = mapped_column(JSON, default=None)
    pricing: Mapped[str | None] = mapped_column(String(256), default=None)
    category: Mapped[str | None] = mapped_column(String(128), default=None)

    brand_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("brands.id", ondelete="CASCADE")
    )

    # -- relationships --
    brand: Mapped["Brand"] = relationship(back_populates="products")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Product {self.name!r}>"
