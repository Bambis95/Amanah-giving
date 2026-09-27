"""Who may do what: visitors, logged-in users and administrators."""

import pytest

from tests.conftest import db_fetch, login, make_project, register

ADMIN_ONLY = [
    ("get", "/api/v1/entities/donations/all", None),
    ("get", "/api/v1/entities/contact_messages/all", None),
    ("get", "/api/v1/entities/contact_messages", None),
    ("get", "/api/v1/users", None),
    ("get", "/api/v1/admin/audit-logs", None),
    ("get", "/api/v1/admin/settings", None),
    ("put", "/api/v1/admin/settings/backend/STRIPE_SECRET_KEY", {"value": "sk_pirate"}),
    ("post", "/api/v1/entities/projects", {"title": "x", "description": "x", "category": "x", "raised": 0, "goal": 1}),
    ("put", "/api/v1/entities/projects/1", {"title": "pirate"}),
    ("delete", "/api/v1/entities/projects/1", None),
    ("put", "/api/v1/entities/contact_messages/1", {"is_read": True}),
    ("delete", "/api/v1/entities/contact_messages/1", None),
    ("put", "/api/v1/users/some-id/role", {"role": "admin"}),
    # Donations change only through the payment flow
    ("post", "/api/v1/entities/donations",
     {"amount": 10_000_000, "cause": "education", "payment_method": "wave", "payment_status": "paid"}),
    ("post", "/api/v1/entities/donations/batch",
     {"items": [{"amount": 10_000_000, "cause": "education", "payment_method": "wave", "payment_status": "paid"}]}),
    ("put", "/api/v1/entities/donations/1", {"payment_status": "paid"}),
    ("put", "/api/v1/entities/donations/batch", {"items": [{"id": 1, "updates": {"payment_status": "paid"}}]}),
    ("delete", "/api/v1/entities/donations/1", None),
    ("delete", "/api/v1/entities/donations/batch", {"ids": [1]}),
    # Unused template features: no access for visitors or regular users
    ("post", "/api/v1/aihub/gentxt", {"messages": [{"role": "user", "content": "bonjour"}], "model": "x"}),
    ("post", "/api/v1/aihub/genimg", {"prompt": "x", "model": "x"}),
    ("post", "/api/v1/storage/create-bucket", {"bucket_name": "x"}),
    ("post", "/api/v1/storage/rename-object", {"bucket_name": "x", "source_key": "a", "target_key": "b"}),
    ("delete", "/api/v1/storage/delete-object", {"bucket_name": "x", "object_key": "a"}),
    ("post", "/api/v1/storage/upload-url", {"bucket_name": "x", "object_key": "a"}),
]


def call(client, method, url, body):
    if body is None:
        return client.request(method.upper(), url)
    return client.request(method.upper(), url, json=body)


@pytest.mark.parametrize("method,url,body", ADMIN_ONLY, ids=[f"{m} {u}" for m, u, _ in ADMIN_ONLY])
def test_visitor_is_refused(client, method, url, body):
    assert call(client, method, url, body).status_code == 401


@pytest.mark.parametrize("method,url,body", ADMIN_ONLY, ids=[f"{m} {u}" for m, u, _ in ADMIN_ONLY])
def test_regular_user_is_refused(client, user, method, url, body):
    assert call(client, method, url, body).status_code == 403


def test_fake_paid_donation_does_not_change_stats(client, user):
    for method, url, body in ADMIN_ONLY:
        if "/donations" in url:
            call(client, method, url, body)
    assert db_fetch("SELECT count(*) AS n FROM donations")[0]["n"] == 0
    assert client.get("/api/v1/stats").json()["total_raised"] == 0


def test_user_sees_only_own_donations(client, user):
    other = db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, user_id, donor_email) "
        "VALUES (5000, 'education', 'wave', 'paid', 'someone-else', 'x@example.com') RETURNING id"
    )[0]["id"]
    mine = db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, user_id) "
        "VALUES (7000, 'health', 'wave', 'paid', $1) RETURNING id",
        user["id"],
    )[0]["id"]
    items = client.get("/api/v1/entities/donations").json()["items"]
    assert [d["id"] for d in items] == [mine]
    assert client.get(f"/api/v1/entities/donations/{other}").status_code == 404
    assert client.get(f"/api/v1/entities/donations/{mine}").status_code == 200


def test_public_pages_need_no_account(client):
    assert client.get("/api/v1/entities/projects/all").status_code == 200
    assert client.get("/api/v1/stats").status_code == 200
    r = client.post(
        "/api/v1/entities/contact_messages",
        json={"name": "Awa", "email": "awa@example.com", "subject": "project", "message": "Je propose un projet"},
    )
    assert r.status_code == 201, r.text


def test_admin_manages_projects_with_audit(client, admin):
    project = make_project(client)
    r = client.put(f"/api/v1/entities/projects/{project['id']}", json={"goal": 2_000_000})
    assert r.status_code == 200 and r.json()["goal"] == 2_000_000
    assert client.delete(f"/api/v1/entities/projects/{project['id']}").status_code == 200
    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs ORDER BY id")]
    assert actions == ["project.create", "project.update", "project.delete"]


def test_admin_reads_and_manages_messages(client, admin):
    client.post(
        "/api/v1/entities/contact_messages",
        json={"name": "Awa", "email": "awa@example.com", "message": "Bonjour"},
    )
    items = client.get("/api/v1/entities/contact_messages/all").json()["items"]
    assert len(items) == 1
    mid = items[0]["id"]
    assert client.put(f"/api/v1/entities/contact_messages/{mid}", json={"is_read": True}).json()["is_read"] is True
    assert client.delete(f"/api/v1/entities/contact_messages/{mid}").status_code == 200


def test_admin_changes_roles_but_not_own(client, admin):
    other = register(client, "autre@example.com")
    login(client, "admin@example.com")
    r = client.put(f"/api/v1/users/{other['id']}/role", json={"role": "admin"})
    assert r.status_code == 200 and r.json()["role"] == "admin"
    assert client.put(f"/api/v1/users/{admin['id']}/role", json={"role": "user"}).status_code == 400


def test_make_admin_script_promotes_first_admin(client):
    import subprocess
    import sys

    register(client, "fondateur@example.com")
    run = lambda email: subprocess.run(  # noqa: E731
        [sys.executable, "-m", "scripts.make_admin", email], capture_output=True, text=True, encoding="utf-8"
    )
    missing = run("personne@example.com")
    assert missing.returncode == 1
    done = run("Fondateur@example.com")
    assert done.returncode == 0, done.stderr
    assert "administrateur" in done.stdout
    assert db_fetch("SELECT role FROM users WHERE email = 'fondateur@example.com'")[0]["role"] == "admin"
    assert login(client, "fondateur@example.com").json()["user"]["role"] == "admin"


def test_settings_never_reveal_secrets(client, admin):
    r = client.get("/api/v1/admin/settings")
    assert r.status_code == 200
    text = r.text
    for secret in ("test-master-key", "test-private-key", "test-secret-key-not-used-anywhere-else"):
        assert secret not in text
