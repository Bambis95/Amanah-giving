"""Accounts, login, sessions and password reset."""

import re
import time

from core.auth import create_access_token
from core.config import settings
from tests.conftest import PASSWORD, db_fetch, login, register, set_role

COOKIE = settings.session_cookie_name


def cookie_max_age(response):
    header = response.headers.get("set-cookie", "")
    match = re.search(r"Max-Age=(\d+)", header)
    return int(match.group(1)) if match else None


def test_register_then_login_sets_httponly_cookie(client):
    user = register(client, "Donateur@Example.com")
    assert user["email"] == "donateur@example.com"  # stored in lowercase
    assert user["role"] == "user"

    r = login(client, "donateur@example.com")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"user"}  # the token is never readable by page scripts
    cookie = r.headers["set-cookie"]
    assert f"{COOKIE}=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert body["user"]["idle_minutes"] == 60
    assert cookie_max_age(r) == 3600

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "donateur@example.com"


def test_register_rejects_short_password_and_duplicates(client):
    r = client.post("/api/v1/auth/register", json={"email": "a@example.com", "password": "court"})
    assert r.status_code == 400
    register(client, "a@example.com")
    r = client.post("/api/v1/auth/register", json={"email": "A@example.com", "password": PASSWORD})
    assert r.status_code == 400


def test_wrong_password_is_rejected(client):
    register(client, "b@example.com")
    assert login(client, "b@example.com", "mauvais-mot-de-passe").status_code == 401
    assert login(client, "inconnu@example.com").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_locked_after_five_failures_even_with_right_password(client):
    register(client, "c@example.com")
    for _ in range(5):
        assert login(client, "c@example.com", "mauvais-mot-de-passe").status_code == 401
    r = login(client, "c@example.com")
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) > 0
    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs")]
    assert actions.count("security.login_locked") == 1


def test_logout_deletes_cookie(client, user):
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_admin_session_is_shorter(client, admin):
    assert admin["idle_minutes"] == 15
    me = client.get("/api/v1/auth/me").json()
    assert me["role"] == "admin" and me["idle_minutes"] == 15


def _cookie_token(user_row, role, *, auth_time, expires_minutes):
    claims = {
        "sub": user_row["id"], "email": user_row["email"], "role": role, "name": None,
        "tv": user_row["token_version"] or 0, "auth_time": auth_time,
    }
    return create_access_token(claims, expires_minutes=expires_minutes)


def test_activity_extends_the_session(client):
    register(client, "d@example.com")
    row = db_fetch("SELECT id, email, token_version FROM users WHERE email = 'd@example.com'")[0]
    now = int(time.time())
    # 10 minutes left of the 60: a request slides the expiry back to a full hour
    client.cookies.set(COOKIE, _cookie_token(row, "user", auth_time=now - 3000, expires_minutes=10))
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert 3500 <= cookie_max_age(r) <= 3600


def test_session_expires_after_absolute_limit(client):
    register(client, "e@example.com")
    row = db_fetch("SELECT id, email, token_version FROM users WHERE email = 'e@example.com'")[0]
    now = int(time.time())
    client.cookies.set(COOKIE, _cookie_token(row, "user", auth_time=now - 13 * 3600, expires_minutes=30))
    assert client.get("/api/v1/auth/me").status_code == 401


def test_expired_token_is_rejected(client):
    register(client, "f@example.com")
    row = db_fetch("SELECT id, email, token_version FROM users WHERE email = 'f@example.com'")[0]
    client.cookies.set(COOKIE, _cookie_token(row, "user", auth_time=int(time.time()), expires_minutes=-1))
    assert client.get("/api/v1/auth/me").status_code == 401


def test_forged_token_is_rejected(client):
    from jose import jwt

    register(client, "g@example.com")
    row = db_fetch("SELECT id FROM users WHERE email = 'g@example.com'")[0]
    forged = jwt.encode({"sub": row["id"], "role": "admin", "tv": 0, "exp": int(time.time()) + 600}, "autre-cle")
    client.cookies.set(COOKIE, forged)
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/users").status_code == 401


def test_cross_site_request_with_cookie_is_blocked(client, user):
    r = client.put("/api/v1/users/profile", json={"name": "Pirate"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    r = client.put("/api/v1/users/profile", json={"name": "Moi"}, headers={"Origin": "http://localhost:3000"})
    assert r.status_code == 200


def test_password_reset_flow(client, sent_emails):
    register(client, "h@example.com")
    login(client, "h@example.com")
    old_session = client.cookies.get(COOKIE)

    r = client.post("/api/v1/auth/forgot-password", json={"email": "h@example.com"})
    assert r.status_code == 200
    assert len(sent_emails) == 1
    body = sent_emails[0].get_body(("plain",)).get_content()
    token = re.search(r"reset-password\?token=([\w-]+)", body).group(1)

    # Unknown email: same answer, no email
    r2 = client.post("/api/v1/auth/forgot-password", json={"email": "personne@example.com"})
    assert r2.json() == r.json() and len(sent_emails) == 1

    assert client.post("/api/v1/auth/reset-password", json={"token": token, "password": "court"}).status_code == 400
    r = client.post("/api/v1/auth/reset-password", json={"token": token, "password": "Nouveau-2026x"})
    assert r.status_code == 200
    # The link works once only
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "password": "Autre-2026x"}).status_code == 400

    # Old sessions are closed, old password refused, new one accepted
    client.cookies.set(COOKIE, old_session)
    assert client.get("/api/v1/auth/me").status_code == 401
    assert login(client, "h@example.com").status_code == 401
    assert login(client, "h@example.com", "Nouveau-2026x").status_code == 200


def test_demoted_admin_loses_access_immediately(client, admin):
    assert client.get("/api/v1/users").status_code == 200
    set_role("admin@example.com", "user")
    assert client.get("/api/v1/users").status_code == 403
