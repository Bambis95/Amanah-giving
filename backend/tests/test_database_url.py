"""Hosts such as Render give postgresql:// URLs: the async driver is added without losing the password."""

from core.database import DatabaseManager


def test_postgresql_url_keeps_password():
    url = DatabaseManager()._normalize_async_database_url("postgresql://amanah:s3cr%21t@db.internal:5432/amanah_giving")
    assert url == "postgresql+asyncpg://amanah:s3cr%21t@db.internal:5432/amanah_giving"


def test_async_url_is_left_unchanged():
    raw = "postgresql+asyncpg://amanah:secret@localhost:5432/amanah_giving"
    assert DatabaseManager()._normalize_async_database_url(raw) == raw
