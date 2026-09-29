"""Staff invitations: invite by email with the role chosen, accept by choosing a password."""

from urllib.parse import parse_qs, urlparse

from tests.conftest import db_fetch, login, register, set_role


def invite(client, email="fatou@example.com", role="president", name="Fatou"):
    return client.post("/api/v1/invitations", json={"email": email, "role": role, "name": name})


def token_of(created):
    return parse_qs(urlparse(created["invite_url"]).query)["token"][0]


def test_admin_invites_and_the_person_joins_with_the_role(client, admin, sent_emails):
    r = invite(client)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["email_sent"] is True and created["invitation"]["role"] == "president"
    assert created["invite_url"].startswith("http://localhost:3000/invitation?token=")
    assert len(sent_emails) == 1 and sent_emails[0]["To"] == "fatou@example.com"
    assert created["invite_url"] in sent_emails[0].get_body(("plain",)).get_content()
    # Only a hash of the token is stored
    assert db_fetch("SELECT token_hash FROM invitations")[0]["token_hash"] != token_of(created)
    assert [i["email"] for i in client.get("/api/v1/invitations").json()] == ["fatou@example.com"]

    client.cookies.clear()
    token = token_of(created)
    preview = client.get("/api/v1/invitations/preview", params={"token": token}).json()
    assert preview["email"] == "fatou@example.com" and preview["role"] == "president"

    r = client.post("/api/v1/invitations/accept", json={"token": token, "password": "Motdepasse-2026", "name": "Fatou Sane"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "president" and r.json()["user"]["name"] == "Fatou Sane"
    # The session is open: the dashboard data is reachable at once
    assert client.get("/api/v1/auth/me").json()["role"] == "president"
    assert client.get("/api/v1/users").status_code == 200

    # The link works once only
    client.cookies.clear()
    again = client.post("/api/v1/invitations/accept", json={"token": token, "password": "Autre-mot-2026"})
    assert again.status_code == 400
    assert login(client, "fatou@example.com").status_code == 200

    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs ORDER BY id")]
    assert "user.invite" in actions and "user.invite_accepted" in actions


def test_president_invites_members_only(client, sent_emails):
    register(client, "president@example.com")
    set_role("president@example.com", "president")
    login(client, "president@example.com")
    assert invite(client, role="member").status_code == 201
    assert invite(client, email="autre@example.com", role="president").status_code == 403
    assert invite(client, email="chef@example.com", role="admin").status_code == 403


def test_members_and_visitors_cannot_invite(client, sent_emails):
    assert invite(client).status_code == 401
    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")
    assert invite(client, role="member").status_code == 403
    assert client.get("/api/v1/invitations").status_code == 403


def test_existing_account_is_not_invited(client, admin, sent_emails):
    register(client, "deja@example.com")
    login(client, "admin@example.com")
    r = invite(client, email="deja@example.com")
    assert r.status_code == 409 and not sent_emails


def test_account_created_meanwhile_keeps_its_role(client, admin, sent_emails):
    """Someone registering with the invited email first must not inherit the invited role."""
    token = token_of(invite(client).json())
    client.cookies.clear()
    register(client, "fatou@example.com")
    r = client.post("/api/v1/invitations/accept", json={"token": token, "password": "Motdepasse-2026"})
    assert r.status_code == 409
    assert db_fetch("SELECT role FROM users WHERE email = 'fatou@example.com'")[0]["role"] == "user"


def test_revoked_expired_or_replaced_links_stop_working(client, admin, sent_emails):
    first = token_of(invite(client).json())
    second_created = invite(client).json()  # a new invitation replaces the pending one
    second = token_of(second_created)
    assert client.get("/api/v1/invitations/preview", params={"token": first}).status_code == 400
    assert len(client.get("/api/v1/invitations").json()) == 1

    assert client.delete(f"/api/v1/invitations/{second_created['invitation']['id']}").status_code == 200
    assert client.get("/api/v1/invitations/preview", params={"token": second}).status_code == 400
    assert client.get("/api/v1/invitations").json() == []

    third = token_of(invite(client).json())
    db_fetch("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE revoked_at IS NULL")
    r = client.post("/api/v1/invitations/accept", json={"token": third, "password": "Motdepasse-2026"})
    assert r.status_code == 400


def test_weak_password_is_refused(client, admin, sent_emails):
    token = token_of(invite(client).json())
    client.cookies.clear()
    r = client.post("/api/v1/invitations/accept", json={"token": token, "password": "court"})
    assert r.status_code == 400
    assert not db_fetch("SELECT id FROM users WHERE email = 'fatou@example.com'")


def test_link_is_returned_even_without_email(client, admin, monkeypatch):
    import routers.invitations

    monkeypatch.setattr(routers.invitations, "email_enabled", lambda: False)
    r = invite(client)
    assert r.status_code == 201
    assert r.json()["email_sent"] is False and "token=" in r.json()["invite_url"]
