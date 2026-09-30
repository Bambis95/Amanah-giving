"""Account suspension: immediate loss of access, reactivation, who may suspend whom."""

from tests.conftest import PASSWORD, db_fetch, login, register, set_role


def user_id(email):
    return db_fetch("SELECT id FROM users WHERE email = $1", email)[0]["id"]


def suspend(client, email, suspended=True):
    return client.put(f"/api/v1/users/{user_id(email)}/suspension", json={"suspended": suspended})


def test_suspended_member_loses_access_at_once_and_can_come_back(client, admin):
    from fastapi.testclient import TestClient
    from main import app

    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    with TestClient(app) as member:
        assert member.post("/api/v1/auth/login", json={"email": "membre@example.com", "password": PASSWORD}).status_code == 200
        assert member.get("/api/v1/auth/me").status_code == 200

        login(client, "admin@example.com")
        r = suspend(client, "membre@example.com")
        assert r.status_code == 200 and r.json()["suspended_at"] is not None

        # The open session stops, and signing in again is refused with a clear reason
        assert member.get("/api/v1/entities/donations/all").status_code == 401
        r = member.post("/api/v1/auth/login", json={"email": "membre@example.com", "password": PASSWORD})
        assert r.status_code == 403 and "suspendu" in r.json()["detail"]

        assert suspend(client, "membre@example.com", False).json()["suspended_at"] is None
        assert member.post("/api/v1/auth/login", json={"email": "membre@example.com", "password": PASSWORD}).status_code == 200
        assert member.get("/api/v1/auth/me").json()["role"] == "member"

    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs ORDER BY id")]
    assert "user.suspend" in actions and "user.reactivate" in actions


def test_wrong_password_on_suspended_account_says_nothing(client, admin):
    register(client, "membre@example.com")
    login(client, "admin@example.com")
    suspend(client, "membre@example.com")
    r = login(client, "membre@example.com", password="mauvais-mot-de-passe")
    assert r.status_code == 401 and "suspendu" not in r.text


def test_president_suspends_members_only_and_nobody_suspends_self(client, admin):
    register(client, "president@example.com")
    set_role("president@example.com", "president")
    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "president@example.com")
    assert suspend(client, "membre@example.com").status_code == 200
    assert suspend(client, "admin@example.com").status_code == 403
    assert suspend(client, "president@example.com").status_code == 400

    login(client, "admin@example.com")
    assert suspend(client, "admin@example.com").status_code == 400
    assert suspend(client, "president@example.com").status_code == 200


def test_members_cannot_suspend(client):
    register(client, "a@example.com")
    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")
    assert suspend(client, "a@example.com").status_code == 403
