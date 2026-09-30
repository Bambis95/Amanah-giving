"""Test setup: the API runs against a dedicated PostgreSQL database, with payments and email faked.

Run from the backend folder:  venv\\Scripts\\python.exe -m pytest
The database named by TEST_DATABASE_URL (default: amanah_giving_test) is emptied before every
test, so it must never be the real database.
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://amanah:amanah_secret@localhost:5432/amanah_giving_test",
)
if not TEST_DATABASE_URL.rsplit("/", 1)[-1].split("?")[0].endswith("_test"):
    raise RuntimeError("The test database name must end with _test: every test empties it")

# Environment variables take precedence over backend/.env, so no real key or mailbox is used
os.environ.update(
    {
        "DATABASE_URL": TEST_DATABASE_URL,
        "IS_LAMBDA": "true",  # no connection pool (each test client has its own event loop) and no log files
        "MGX_IGNORE_INIT_DATA": "1",
        "MGX_IGNORE_INIT_ADMIN": "1",
        "JWT_SECRET_KEY": "test-secret-key-not-used-anywhere-else",
        "FRONTEND_URL": "http://localhost:3000",
        "CORS_ORIGINS": "",
        "SESSION_COOKIE_SECURE": "false",
        "JWT_EXPIRE_MINUTES": "60",
        "ADMIN_IDLE_MINUTES": "15",
        "SESSION_MAX_HOURS": "12",
        # Most tests sign admins in directly; tests/test_login_code.py turns the email code on
        "LOGIN_CODE_REQUIRED": "false",
        "STRIPE_SECRET_KEY": "",
        "PAYDUNYA_MODE": "test",
        "PAYDUNYA_MASTER_KEY": "test-master-key",
        "PAYDUNYA_PRIVATE_KEY": "test-private-key",
        "PAYDUNYA_TOKEN": "test-token",
        "SMTP_HOST": "smtp.test.invalid",
        "SMTP_USERNAME": "",
        "SMTP_PASSWORD": "",
        "EMAIL_FROM": "dons@example.com",
    }
)

import asyncpg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

TABLES = [
    "audit_logs",
    "login_attempts",
    "password_reset_tokens",
    "invitations",
    "images",
    "login_codes",
    "finance_entries",
    "finance_documents",
    "project_budget_lines",
    "project_updates",
    "contact_messages",
    "donations",
    "projects",
    "users",
]


def _truncate() -> None:
    async def run():
        conn = await asyncpg.connect(TEST_DATABASE_URL.replace("postgresql+asyncpg", "postgresql"))
        try:
            await conn.execute(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE")
        finally:
            await conn.close()

    asyncio.run(run())


@pytest.fixture(scope="session")
def app_client():
    with TestClient(app) as client:  # runs the startup: tables are created if missing
        yield client


@pytest.fixture
def client(app_client):
    _truncate()
    app_client.cookies.clear()
    yield app_client
    app_client.cookies.clear()


@pytest.fixture
def sent_emails(monkeypatch):
    """Emails are captured instead of sent."""
    sent = []

    def fake_send(message, context):
        sent.append(message)

    import routers.auth
    import routers.invitations
    import routers.mobile_deposits
    import routers.payment_checkout

    monkeypatch.setattr(routers.auth, "send_email", fake_send)
    monkeypatch.setattr(routers.invitations, "send_email", fake_send)
    monkeypatch.setattr(routers.payment_checkout, "send_email", fake_send)
    monkeypatch.setattr(routers.mobile_deposits, "send_email", fake_send)
    return sent


# ---------- helpers ----------

PASSWORD = "Motdepasse-2026"


def register(client, email, password=PASSWORD, name="Test"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": name})
    assert r.status_code == 200, r.text
    return r.json()["user"]


def login(client, email, password=PASSWORD):
    client.cookies.clear()
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def set_role(email, role):
    async def run():
        conn = await asyncpg.connect(TEST_DATABASE_URL.replace("postgresql+asyncpg", "postgresql"))
        try:
            await conn.execute("UPDATE users SET role = $1 WHERE email = $2", role, email)
        finally:
            await conn.close()

    asyncio.run(run())


def db_fetch(query, *args):
    async def run():
        conn = await asyncpg.connect(TEST_DATABASE_URL.replace("postgresql+asyncpg", "postgresql"))
        try:
            return await conn.fetch(query, *args)
        finally:
            await conn.close()

    return asyncio.run(run())


@pytest.fixture
def admin(client):
    """A logged-in administrator (the client carries the session cookie)."""
    register(client, "admin@example.com", name="Admin")
    set_role("admin@example.com", "admin")
    r = login(client, "admin@example.com")
    assert r.status_code == 200, r.text
    return r.json()["user"]


@pytest.fixture
def user(client):
    """A logged-in regular user."""
    register(client, "user@example.com", name="Utilisateur")
    r = login(client, "user@example.com")
    assert r.status_code == 200, r.text
    return r.json()["user"]


def make_project(client, **overrides):
    """Create a project as admin (the caller must be logged in as admin)."""
    data = {
        "title": "Puits au village",
        "description": "Un puits pour 300 familles",
        "category": "water",
        "raised": 0,
        "goal": 1_000_000,
        "donors": 0,
        "status": "active",
        "is_featured": True,
        "urgent": False,
    }
    data.update(overrides)
    r = client.post("/api/v1/entities/projects", json=data)
    assert r.status_code == 201, r.text
    return r.json()
