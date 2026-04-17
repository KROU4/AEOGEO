"""Railway/Heroku often set DATABASE_URL with postgresql:// (no async driver)."""

from app.config import Settings, normalize_postgres_url_for_async


def test_normalize_plain_postgresql_to_asyncpg() -> None:
    assert (
        normalize_postgres_url_for_async("postgresql://u:p@h:5432/db")
        == "postgresql+asyncpg://u:p@h:5432/db"
    )


def test_normalize_postgres_scheme_to_asyncpg() -> None:
    assert (
        normalize_postgres_url_for_async("postgres://u:p@h:5432/db")
        == "postgresql+asyncpg://u:p@h:5432/db"
    )


def test_passthrough_when_async_driver_present() -> None:
    u = "postgresql+asyncpg://u:p@h:5432/db"
    assert normalize_postgres_url_for_async(u) == u


def test_settings_applies_normalization() -> None:
    s = Settings(database_url="postgresql://u:p@localhost:5432/db")
    assert s.database_url == "postgresql+asyncpg://u:p@localhost:5432/db"
