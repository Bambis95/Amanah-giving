"""Team accounts (treasurer, accountant, president, admin) reach the dashboard only with an authenticator app."""

import time

import pytest

from core.config import settings
from services import totp
from tests.conftest import login, register, set_role


@pytest.fixture
def required(monkeypatch):
    monkeypatch.setattr(settings, "require_2fa_for_team", True)


def turn_on(client):
    secret = client.post("/api/v1/auth/2fa/setup").json()["secret"]
    code = totp._code_at(secret, int(time.time() // totp.STEP_SECONDS))
    assert client.post("/api/v1/auth/2fa/enable", json={"code": code}).status_code == 200


def as_role(client, email, role):
    register(client, email)
    set_role(email, role)
    login(client, email)


def test_admin_is_stopped_until_the_app_is_on(client, admin, required):
    r = client.get("/api/v1/users")
    assert r.status_code == 403 and "double authentification" in r.json()["detail"]
    assert client.get("/api/v1/auth/me").json()["two_factor"] is False  # "Mon espace" stays open
    turn_on(client)
    assert client.get("/api/v1/users").status_code == 200


@pytest.mark.parametrize("role,url", [
    ("treasurer", "/api/v1/finance/summary"),
    ("accountant", "/api/v1/finance/summary"),
    ("president", "/api/v1/admin/audit-logs"),
])
def test_every_team_role_needs_it(client, required, role, url):
    as_role(client, f"{role}@example.com", role)
    assert client.get(url).status_code == 403
    turn_on(client)
    assert client.get(url).status_code == 200


def test_members_are_not_asked(client, required):
    as_role(client, "membre@example.com", "member")
    assert client.get("/api/v1/entities/donations/all").status_code == 200


def test_president_downloads_the_export_with_the_app(client, required):
    as_role(client, "presidente@example.com", "president")
    assert client.get("/api/v1/admin/export").status_code == 403
    turn_on(client)
    r = client.get("/api/v1/admin/export")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    # Settings stay read-only for her
    assert client.put("/api/v1/site/settings", json={}).status_code in (403, 422)
