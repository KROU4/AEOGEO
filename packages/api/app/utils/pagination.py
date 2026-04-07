"""Cursor-based pagination utilities for list endpoints."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import Select, tuple_


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False


def encode_cursor(created_at: datetime, id: UUID) -> str:
    raw = f"{created_at.isoformat()}|{id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, id_str = raw.split("|", 1)
        return datetime.fromisoformat(ts_str), UUID(id_str)
    except Exception as exc:
        raise ValueError(f"Invalid cursor: {cursor}") from exc


def apply_cursor_pagination(
    query: Select,
    model_class: type,
    cursor: str | None,
    limit: int,
) -> Select:
    """Apply cursor-based pagination to a SQLAlchemy select.

    Orders by (created_at DESC, id DESC) and fetches limit+1 rows
    to determine has_more.
    """
    if cursor:
        cursor_ts, cursor_id = decode_cursor(cursor)
        query = query.where(
            tuple_(model_class.created_at, model_class.id)
            < tuple_(cursor_ts, cursor_id)
        )

    return (
        query
        .order_by(model_class.created_at.desc(), model_class.id.desc())
        .limit(limit + 1)
    )


def paginate_results(
    rows: list,
    limit: int,
    *,
    created_at_attr: str = "created_at",
    id_attr: str = "id",
) -> tuple[list, str | None, bool]:
    """Trim rows to limit and compute next_cursor.

    Returns (items, next_cursor, has_more).
    """
    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor(
            getattr(last, created_at_attr),
            getattr(last, id_attr),
        )

    return items, next_cursor, has_more
