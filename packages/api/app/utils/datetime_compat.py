"""Match Python datetimes to TIMESTAMP WITHOUT TIME ZONE (naive UTC in DB)."""

from __future__ import annotations

from datetime import UTC, datetime


def naive_utc(value: datetime) -> datetime:
    """Aware → UTC-naive; naive values unchanged (treated as UTC)."""
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)
