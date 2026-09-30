"""Email code at sign-in for presidents and admins."""

import re

import pytest

from core.config import settings
from services import email as mail
from tests.conftest import PASSWORD, db_fetch, login, register, set_role


@pytest.fixture
def codes(monkeypatch):
    """Code required; emails captured. Set `fail = True` to simulate a mail outage."""
    monkeypatch.setattr(settings, "login_code_required", True)
    state = type("State", (), {"sent": [], "fail": False})()

    def fake_deliver(message, context):
        if state.fail:
            return False
        state.sent.append(message)
        return True

    monkeypatch.setattr(mail, "deliver", fake_deliver)
    return state


def code_in(message):
    return re.search(r"(\d{3}) (\d{3})", message["Subject"]).group(0).replace(" ", "")


def staff(client, email="admin@example.com", role="admin"):
    register(client, email)
    set_role(email, role)


def test_admin_needs_the_emailed_code(client, codes):
    staff(client)
    r = login(client, "admin@example.com")
    assert r.status_code == 200
    body = r.json()
    assert body["code_required"] is True and "user" not in body
    assert body["email_hint"] == "ad•••@example.com"
    assert client.get("/api/v1/auth/me").status_code == 401  # no session yet
    assert len(codes.sent) == 1 and codes.sent[0]["To"] == "admin@example.com"

    # Only hashes are stored
    stored = db_fetch("SELECT challenge_hash, code_hash FROM login_codes")[0]
    assert body["challenge"] not in stored.values() and code_in(codes.sent[0]) not in stored.values()

    r = client.post("/api/v1/auth/login/code", json={"challenge": body["challenge"], "code": code_in(codes.sent[0])})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    assert client.get("/api/v1/auth/me").json()["role"] == "admin"

    # A code works once
    client.cookies.clear()
    again = client.post("/api/v1/auth/login/code", json={"challenge": body["challenge"], "code": code_in(codes.sent[0])})
    assert again.status_code == 400


def test_five_wrong_codes_end_the_attempt(client, codes):
    staff(client, "president@example.com", "president")
    challenge = login(client, "president@example.com").json()["challenge"]
    good = code_in(codes.sent[0])
    wrong = "000000" if good != "000000" else "111111"
    for left in (4, 3, 2, 1):
        r = client.post("/api/v1/auth/login/code", json={"challenge": challenge, "code": wrong})
        assert r.status_code == 400 and f"{left} essai" in r.json()["detail"]
    r = client.post("/api/v1/auth/login/code", json={"challenge": challenge, "code": wrong})
    assert "Trop d'essais" in r.json()["detail"]
    # Even the right code no longer works: guessing 1 in a million five times is all one gets
    assert client.post("/api/v1/auth/login/code", json={"challenge": challenge, "code": good}).status_code == 400


def test_new_sign_in_replaces_the_previous_code(client, codes):
    staff(client)
    first = login(client, "admin@example.com").json()["challenge"]
    first_code = code_in(codes.sent[0])
    second = login(client, "admin@example.com").json()["challenge"]
    assert client.post("/api/v1/auth/login/code", json={"challenge": first, "code": first_code}).status_code == 400
    assert client.post("/api/v1/auth/login/code", json={"challenge": second, "code": code_in(codes.sent[1])}).status_code == 200


def test_expired_code_is_refused(client, codes):
    staff(client)
    challenge = login(client, "admin@example.com").json()["challenge"]
    db_fetch("UPDATE login_codes SET expires_at = now() - interval '1 minute'")
    r = client.post("/api/v1/auth/login/code", json={"challenge": challenge, "code": code_in(codes.sent[0])})
    assert r.status_code == 400 and "expiré" in r.json()["detail"]


def test_donors_and_members_sign_in_directly(client, codes):
    register(client, "donateur@example.com")
    staff(client, "membre@example.com", "member")
    assert "user" in login(client, "donateur@example.com").json()
    assert "user" in login(client, "membre@example.com").json()
    assert codes.sent == []


def test_mail_outage_lets_the_admin_in_and_is_logged(client, codes):
    codes.fail = True
    staff(client)
    r = login(client, "admin@example.com")
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs")]
    assert "security.login_code_unavailable" in actions


def test_wrong_password_sends_no_code(client, codes):
    staff(client)
    assert login(client, "admin@example.com", password="mauvais").status_code == 401
    assert codes.sent == []


def test_code_for_a_suspended_account_is_refused(client, codes):
    staff(client)
    challenge = login(client, "admin@example.com").json()["challenge"]
    db_fetch("UPDATE users SET suspended_at = now() WHERE email = 'admin@example.com'")
    r = client.post("/api/v1/auth/login/code", json={"challenge": challenge, "code": code_in(codes.sent[0])})
    assert r.status_code == 403
    assert PASSWORD  # the password was right; only the suspension blocks
