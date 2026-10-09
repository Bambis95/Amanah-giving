"""Platform commission: monthly statement of what is owed, rate history, payments, transparency."""

import json
from datetime import datetime, timezone

from tests.conftest import db_fetch, login, register, set_role

URL = "/api/v1/admin/commission"


def add_donation(amount, day, status="paid", cause="general", provider="paydunya"):
    db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, payment_provider, created_at) "
        "VALUES ($1, $2, 'wave', $3, $4, $5) RETURNING id",
        amount, cause, status, provider, datetime.fromisoformat(f"{day}T10:00:00").replace(tzinfo=timezone.utc),
    )


def set_history(history):
    db_fetch(
        "INSERT INTO site_settings (key, value, updated_at) VALUES ('platform_commission', $1::json, now()) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING key",
        json.dumps({"payee": "Khadim BA", "history": history}),
    )


def test_rate_is_set_by_admins_announced_and_sealed(client, admin):
    r = client.put(URL, json={"percent": "5", "payee": "Khadim BA"})
    assert r.status_code == 200, r.text
    assert r.json()["percent"] == "5"
    assert client.get("/api/v1/site").json()["platform_fee_percent"] == "5"  # shown to donors
    assert db_fetch("SELECT count(*) AS n FROM audit_logs WHERE action = 'finance.commission_settings'")[0]["n"] == 1
    assert client.put(URL, json={"percent": "25"}).status_code == 422  # capped at 20 %

    register(client, "pres@example.com")
    set_role("pres@example.com", "president")
    login(client, "pres@example.com")
    assert client.get(URL).status_code == 200  # the client sees everything
    assert client.put(URL, json={"percent": "0"}).status_code == 403


def test_statement_counts_each_donation_at_the_rate_of_its_day(client, admin):
    set_history([{"since": "2026-01-01", "percent": "5"}, {"since": "2026-03-01", "percent": "4"}])
    add_donation(10_000, "2026-02-10")                     # 5 % → 500
    add_donation(3_333, "2026-02-20")                      # 5 % → 166 (rounded down)
    add_donation(20_000, "2026-03-05", provider="mobile_qr")  # QR deposit, 4 % → 800
    add_donation(50_000, "2026-03-06", status="pending")  # not paid: nothing
    add_donation(5_000, "2026-03-07", cause="membership")  # club fee: not a donation
    add_donation(7_000, "2025-12-30")                      # before any rate: 0

    data = client.get(URL, params={"year": 2026}).json()
    assert data["owed"] == 500 + 166 + 800
    assert [(m["month"], m["donations"], m["owed"]) for m in data["months"]] == [("2026-03", 1, 800), ("2026-02", 2, 666)]

    # The client pays 1 000: the treasurer records it in Finances
    r = client.post("/api/v1/finance/entries", json={
        "kind": "expense", "entry_date": "2026-03-31", "amount": 1000, "category": "platform",
        "label": "Commission février", "payment_method": "wave",
    })
    assert r.status_code in (200, 201), r.text
    assert client.get(URL, params={"year": 2026}).json()["paid"] == 0  # not validated yet
    register(client, "compta@example.com")
    set_role("compta@example.com", "accountant")
    login(client, "compta@example.com")
    assert client.post(f"/api/v1/finance/entries/{r.json()['id']}/validate").status_code == 200
    data = client.get(URL, params={"year": 2026}).json()
    assert (data["paid"], data["balance"]) == (1000, 466)

    pdf = client.get(f"{URL}/statement.pdf", params={"year": 2026})
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf" and pdf.content.startswith(b"%PDF")


def test_no_rate_no_commission(client, admin):
    add_donation(10_000, "2026-02-10")
    data = client.get(URL).json()
    assert data["owed"] == 0 and data["percent"] == "0"
    assert client.get("/api/v1/site").json()["platform_fee_percent"] is None
