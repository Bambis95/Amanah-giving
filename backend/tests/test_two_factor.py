"""Authenticator app (Google Authenticator): turn on with the QR code, sign in, recovery codes, turn off."""

import io
import time
import zipfile
from urllib.parse import parse_qs, urlparse

from services import totp
from tests.conftest import PASSWORD, db_fetch, login, register, set_role

URL = "/api/v1/auth/2fa"


def code(secret, offset=0):
    return totp._code_at(secret, int(time.time() // totp.STEP_SECONDS) + offset)


def turn_on(client):
    setup = client.post(f"{URL}/setup").json()
    query = parse_qs(urlparse(setup["otpauth_uri"]).query)
    assert setup["otpauth_uri"].startswith("otpauth://totp/") and query["secret"] == [setup["secret"]]
    r = client.post(f"{URL}/enable", json={"code": code(setup["secret"])})
    assert r.status_code == 200, r.text
    return setup["secret"], r.json()["recovery_codes"]


def sign_in(client, email):
    client.cookies.clear()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


def test_any_account_can_turn_it_on_and_must_then_give_a_code(client, sent_emails):
    register(client, "awa@example.com")
    login(client, "awa@example.com")
    assert client.get(URL).json()["enabled"] is False
    secret, recovery = turn_on(client)
    assert len(recovery) == 8 and client.get(URL).json() == {**client.get(URL).json(), "enabled": True, "recovery_left": 8}

    step = sign_in(client, "awa@example.com")
    assert step["code_required"] is True and step["method"] == "totp" and "user" not in step
    assert client.get("/api/v1/auth/me").status_code == 401  # the password alone opens nothing

    wrong = client.post("/api/v1/auth/login/code", json={"challenge": step["challenge"], "code": "000000"})
    assert wrong.status_code == 400 and "Code incorrect" in wrong.json()["detail"]
    # The code used to turn it on cannot be replayed
    replay = client.post("/api/v1/auth/login/code", json={"challenge": step["challenge"], "code": code(secret)})
    assert replay.status_code == 400
    ok = client.post("/api/v1/auth/login/code", json={"challenge": step["challenge"], "code": code(secret, 1)})
    assert ok.status_code == 200, ok.text
    assert client.get("/api/v1/auth/me").json()["email"] == "awa@example.com"
    assert sent_emails == []  # nothing goes by email
    assert db_fetch("SELECT count(*) AS n FROM audit_logs WHERE action = 'security.2fa_enabled'")[0]["n"] == 1


def test_staff_with_the_app_skip_the_email_code(client, sent_emails, monkeypatch):
    from core.config import settings

    register(client, "treso@example.com")
    set_role("treso@example.com", "treasurer")
    login(client, "treso@example.com")  # tests sign staff in without the email code
    turn_on(client)
    monkeypatch.setattr(settings, "login_code_required", True)
    assert sign_in(client, "treso@example.com")["method"] == "totp"
    assert sent_emails == []


def test_recovery_code_works_once_and_is_logged(client):
    register(client, "awa@example.com")
    login(client, "awa@example.com")
    _, recovery = turn_on(client)

    step = sign_in(client, "awa@example.com")
    r = client.post("/api/v1/auth/login/code", json={"challenge": step["challenge"], "code": recovery[0].upper()})
    assert r.status_code == 200, r.text
    assert client.get(URL).json()["recovery_left"] == 7
    assert db_fetch("SELECT count(*) AS n FROM audit_logs WHERE action = 'security.2fa_recovery_used'")[0]["n"] == 1

    step = sign_in(client, "awa@example.com")
    again = client.post("/api/v1/auth/login/code", json={"challenge": step["challenge"], "code": recovery[0]})
    assert again.status_code == 400


def test_turning_off_needs_password_and_code(client):
    register(client, "awa@example.com")
    login(client, "awa@example.com")
    secret, _ = turn_on(client)
    assert client.post(f"{URL}/disable", json={"password": "faux-mot-de-passe", "code": code(secret, 1)}).status_code == 400
    r = client.post(f"{URL}/disable", json={"password": PASSWORD, "code": code(secret, 1)})
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert "user" in sign_in(client, "awa@example.com")  # back to the password alone


def test_admin_resets_a_lost_phone_but_never_the_owner(client, admin):
    register(client, "awa@example.com")
    login(client, "awa@example.com")
    turn_on(client)
    awa = db_fetch("SELECT id FROM users WHERE email = 'awa@example.com'")[0]["id"]

    login(client, "admin@example.com")
    users = client.get("/api/v1/users").json()
    assert next(u for u in users if u["email"] == "awa@example.com")["two_factor"] is True
    assert client.post(f"/api/v1/users/{awa}/2fa/reset").status_code == 200
    assert db_fetch("SELECT totp_secret FROM users WHERE id = $1", awa)[0]["totp_secret"] is None

    register(client, "dev@example.com")
    set_role("dev@example.com", "admin")
    db_fetch("UPDATE users SET is_technical_owner = true WHERE email = 'dev@example.com' RETURNING id")
    dev = db_fetch("SELECT id FROM users WHERE email = 'dev@example.com'")[0]["id"]
    login(client, "admin@example.com")
    assert client.post(f"/api/v1/users/{dev}/2fa/reset").status_code == 403


def test_secrets_never_leave_the_database(client, admin):
    turn_on(client)
    stored = db_fetch("SELECT totp_secret, totp_recovery FROM users WHERE email = 'admin@example.com'")[0]
    assert stored["totp_secret"] and not stored["totp_secret"].isupper()  # encrypted, not the base32 secret
    archive = zipfile.ZipFile(io.BytesIO(client.get("/api/v1/admin/export").content))
    accounts = archive.read("comptes.csv").decode("utf-8-sig")
    header = accounts.splitlines()[0].split(";")
    assert not {"totp_secret", "totp_pending", "totp_recovery", "totp_last_step"} & set(header)
    assert stored["totp_secret"] not in accounts
