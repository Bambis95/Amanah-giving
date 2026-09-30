"""Donor space: one's own donations only, profile name, password change."""

from fastapi.testclient import TestClient

from main import app
from tests.conftest import PASSWORD, db_fetch, login, register


def add_donation(user_id, amount=5000, status="paid"):
    return db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, user_id) VALUES ($1, 'youth', 'wave', $2, $3) RETURNING id",
        amount, status, user_id,
    )[0]["id"]


def test_donor_sees_only_own_donations_and_receipts(client):
    me = register(client, "awa@example.com")
    other = register(client, "moussa@example.com")
    mine = add_donation(me["id"], 10_000)
    add_donation(me["id"], 2_000, "pending")
    theirs = add_donation(other["id"], 50_000)
    login(client, "awa@example.com")
    items = client.get("/api/v1/entities/donations", params={"limit": 100}).json()["items"]
    assert sorted(d["amount"] for d in items) == [2_000, 10_000]
    assert client.get(f"/api/v1/entities/donations/{mine}/receipt").status_code == 200
    assert client.get(f"/api/v1/entities/donations/{theirs}/receipt").status_code == 404


def test_profile_name_and_password_change(client):
    register(client, "awa@example.com", name="Awa")
    login(client, "awa@example.com")
    assert client.put("/api/v1/users/profile", json={"name": "Awa Diop"}).json()["name"] == "Awa Diop"

    with TestClient(app) as other_device:
        assert other_device.post("/api/v1/auth/login", json={"email": "awa@example.com", "password": PASSWORD}).status_code == 200

        bad = client.post("/api/v1/auth/change-password", json={"current_password": "faux", "new_password": "Nouveau-mot-2026"})
        assert bad.status_code == 400
        assert client.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": "court"}).status_code == 400
        assert client.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": PASSWORD}).status_code == 400

        ok = client.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": "Nouveau-mot-2026"})
        assert ok.status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 200  # this browser stays signed in
        assert other_device.get("/api/v1/auth/me").status_code == 401  # the other device is signed out

    assert login(client, "awa@example.com").status_code == 401
    assert login(client, "awa@example.com", password="Nouveau-mot-2026").status_code == 200
    assert db_fetch("SELECT count(*) AS n FROM audit_logs WHERE action = 'security.password_change'")[0]["n"] == 1
