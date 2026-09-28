"""Club roles: member (read-only dashboard), president (day-to-day management), admin (everything)."""

import pytest

from tests.conftest import db_fetch, login, make_project, register, set_role


def as_role(client, email, role):
    register(client, email)
    set_role(email, role)
    r = login(client, email)
    assert r.status_code == 200, r.text
    return r.json()["user"]


def add_donation(email="donateur@example.com", phone="+221 77 000 00 00"):
    return db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, donor_first_name, donor_email, donor_phone) "
        "VALUES (5000, 'general', 'wave', 'paid', 'Awa', $1, $2) RETURNING id",
        email, phone,
    )[0]["id"]


# ---------- member ----------

def test_member_reads_donations_without_contact_details(client):
    add_donation()
    member = as_role(client, "membre@example.com", "member")
    assert member["idle_minutes"] == 15  # staff accounts get the short idle timeout
    items = client.get("/api/v1/entities/donations/all").json()["items"]
    assert len(items) == 1
    assert items[0]["donor_first_name"] == "Awa" and items[0]["amount"] == 5000
    assert items[0]["donor_email"] is None and items[0]["donor_phone"] is None


@pytest.mark.parametrize("method,url,body", [
    ("get", "/api/v1/entities/contact_messages/all", None),
    ("get", "/api/v1/users", None),
    ("get", "/api/v1/admin/audit-logs", None),
    ("get", "/api/v1/admin/settings", None),
    ("post", "/api/v1/entities/projects", {"title": "x", "description": "x", "category": "youth", "raised": 0, "goal": 1}),
    ("post", "/api/v1/payment/mobile-deposit/1/confirm", None),
])
def test_member_cannot_manage(client, method, url, body):
    as_role(client, "membre@example.com", "member")
    r = client.request(method.upper(), url, json=body) if body else client.request(method.upper(), url)
    assert r.status_code == 403


# ---------- president ----------

def test_president_manages_the_club(client):
    add_donation()
    as_role(client, "president@example.com", "president")
    items = client.get("/api/v1/entities/donations/all").json()["items"]
    assert items[0]["donor_email"] == "donateur@example.com"  # needed to contact donors
    project = make_project(client, category="youth")
    assert client.put(f"/api/v1/entities/projects/{project['id']}", json={"goal": 5}).status_code == 200
    assert client.get("/api/v1/entities/contact_messages/all").status_code == 200
    assert client.get("/api/v1/admin/audit-logs").status_code == 200
    assert client.get("/api/v1/users").status_code == 200


def test_president_has_no_technical_settings(client):
    as_role(client, "president@example.com", "president")
    assert client.get("/api/v1/admin/settings").status_code == 403


def test_president_appoints_members_only(client):
    other = register(client, "futur-membre@example.com")
    boss = register(client, "admin@example.com")
    set_role("admin@example.com", "admin")
    as_role(client, "president@example.com", "president")

    r = client.put(f"/api/v1/users/{other['id']}/role", json={"role": "member"})
    assert r.status_code == 200 and r.json()["role"] == "member"
    assert client.put(f"/api/v1/users/{other['id']}/role", json={"role": "user"}).status_code == 200
    # Cannot create presidents or admins, nor touch an admin account
    assert client.put(f"/api/v1/users/{other['id']}/role", json={"role": "president"}).status_code == 403
    assert client.put(f"/api/v1/users/{other['id']}/role", json={"role": "admin"}).status_code == 403
    assert client.put(f"/api/v1/users/{boss['id']}/role", json={"role": "user"}).status_code == 403
    actions = [r["summary"] for r in db_fetch("SELECT summary FROM audit_logs WHERE action = 'user.role_change'")]
    assert any("membre du club" in s for s in actions)


# ---------- admin ----------

def test_admin_appoints_a_president(client):
    other = register(client, "president@example.com")
    as_role(client, "admin@example.com", "admin")
    r = client.put(f"/api/v1/users/{other['id']}/role", json={"role": "president"})
    assert r.status_code == 200 and r.json()["role"] == "president"
    assert client.put(f"/api/v1/users/{other['id']}/role", json={"role": "chef"}).status_code == 422
