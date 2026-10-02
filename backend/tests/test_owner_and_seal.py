"""Technical owner (visible, protected, handed over only by himself) and the sealed audit journal."""

from tests.conftest import db_fetch, login, register, set_role


def make_owner(email):
    db_fetch("UPDATE users SET is_technical_owner = true WHERE email = $1 RETURNING id", email)


def user_id(email):
    return db_fetch("SELECT id FROM users WHERE email = $1", email)[0]["id"]


def test_other_admins_cannot_demote_or_suspend_the_owner(client, admin):
    register(client, "dev@example.com")
    set_role("dev@example.com", "admin")
    make_owner("dev@example.com")
    dev = user_id("dev@example.com")

    login(client, "admin@example.com")
    users = client.get("/api/v1/users").json()
    assert next(u for u in users if u["email"] == "dev@example.com")["is_technical_owner"] is True  # visible to the team
    for call in (
        lambda: client.put(f"/api/v1/users/{dev}/role", json={"role": "user"}),
        lambda: client.put(f"/api/v1/users/{dev}/suspension", json={"suspended": True}),
    ):
        r = call()
        assert r.status_code == 403 and "propriétaire technique" in r.json()["detail"]
    # Only the owner can hand the status over
    assert client.post("/api/v1/users/technical-owner/transfer", json={"to_user_id": user_id("admin@example.com")}).status_code == 403


def test_owner_hands_over_to_an_admin_or_gives_it_up(client, admin):
    register(client, "dev@example.com")
    set_role("dev@example.com", "admin")
    register(client, "simple@example.com")
    make_owner("dev@example.com")
    login(client, "dev@example.com")
    assert client.get("/api/v1/auth/me").json()["is_technical_owner"] is True

    r = client.post("/api/v1/users/technical-owner/transfer", json={"to_user_id": user_id("simple@example.com")})
    assert r.status_code == 400  # not an administrator

    r = client.post("/api/v1/users/technical-owner/transfer", json={"to_user_id": user_id("admin@example.com")})
    assert r.status_code == 200
    owners = db_fetch("SELECT email FROM users WHERE is_technical_owner")
    assert [o["email"] for o in owners] == ["admin@example.com"]
    # The former owner is a normal admin again: the new owner can now change his role
    login(client, "admin@example.com")
    assert client.put(f"/api/v1/users/{user_id('dev@example.com')}/role", json={"role": "president"}).status_code == 200
    # Giving the status up (end of contract): nobody holds it any more
    assert client.post("/api/v1/users/technical-owner/transfer", json={}).status_code == 200
    assert db_fetch("SELECT count(*) AS n FROM users WHERE is_technical_owner")[0]["n"] == 0
    actions = [r["action"] for r in db_fetch("SELECT action FROM audit_logs ORDER BY id")]
    assert actions.count("security.owner_transfer") == 2


def test_journal_seal_detects_changes_and_deletions(client, admin):
    register(client, "a@example.com")
    for role in ("member", "user", "member"):
        client.put(f"/api/v1/users/{user_id('a@example.com')}/role", json={"role": role})
    check = client.get("/api/v1/admin/audit-logs/verify").json()
    assert check["intact"] is True and check["checked"] >= 3 and len(check["last_seal"]) == 64

    entries = db_fetch("SELECT id FROM audit_logs WHERE seal IS NOT NULL ORDER BY id")
    middle = entries[1]["id"]
    # Someone with database access rewrites an entry...
    db_fetch("UPDATE audit_logs SET summary = 'rien' WHERE id = $1 RETURNING id", middle)
    check = client.get("/api/v1/admin/audit-logs/verify").json()
    assert check["intact"] is False and check["first_broken_id"] == middle


def test_deleting_an_entry_breaks_the_chain(client, admin):
    register(client, "a@example.com")
    for role in ("member", "user", "member"):
        client.put(f"/api/v1/users/{user_id('a@example.com')}/role", json={"role": role})
    entries = db_fetch("SELECT id FROM audit_logs ORDER BY id")
    db_fetch("DELETE FROM audit_logs WHERE id = $1 RETURNING id", entries[1]["id"])
    check = client.get("/api/v1/admin/audit-logs/verify").json()
    assert check["intact"] is False and check["first_broken_id"] == entries[2]["id"]
