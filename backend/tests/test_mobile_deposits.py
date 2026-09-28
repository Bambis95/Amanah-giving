"""Wave / Orange Money deposits made with the QR codes: declared by the donor, confirmed by an admin."""

from tests.conftest import db_fetch, login, make_project, register

URL = "/api/v1/payment/mobile-deposit"


def declare(client, **data):
    payload = {
        "amount": 5000,
        "payment_method": "wave",
        "transaction_ref": "T-ABC-12345",
        "donor_phone": "+221 77 000 00 00",
        "donor_first_name": "Awa",
        "donor_email": "awa@example.com",
    }
    payload.update(data)
    return client.post(URL, json=payload)


def stats(client):
    return client.get("/api/v1/stats").json()


def test_declared_deposit_waits_for_admin_confirmation(client, admin, sent_emails):
    project = make_project(client)
    client.cookies.clear()

    r = declare(client, project_id=project["id"])
    assert r.status_code == 201, r.text
    donation_id = r.json()["donation_id"]
    row = db_fetch("SELECT * FROM donations WHERE id = $1", donation_id)[0]
    assert row["payment_status"] == "pending" and row["payment_provider"] == "mobile_qr"
    assert row["payment_reference"] == "T-ABC-12345" and row["cause"] == project["category"]
    # Not counted until an admin has checked the operator account
    assert stats(client)["total_raised"] == 0
    assert sent_emails == []

    login(client, "admin@example.com")
    r = client.post(f"{URL}/{donation_id}/confirm")
    assert r.status_code == 200 and r.json()["payment_status"] == "paid"
    assert stats(client)["total_raised"] == 5000
    totals = db_fetch("SELECT raised, donors FROM projects WHERE id = $1", project["id"])[0]
    assert (totals["raised"], totals["donors"]) == (5000, 1)
    assert len(sent_emails) == 1 and sent_emails[0]["To"] == "awa@example.com"
    # Confirming twice is refused (it would be counted twice)
    assert client.post(f"{URL}/{donation_id}/confirm").status_code == 409
    actions = [r["action"] for r in db_fetch("SELECT action FROM audit_logs ORDER BY id")]
    assert "donation.confirm" in actions


def test_rejected_deposit_is_never_counted(client, admin):
    donation_id = declare(client, transaction_ref="T-FAUX-999").json()["donation_id"]
    r = client.post(f"{URL}/{donation_id}/reject")
    assert r.status_code == 200 and r.json()["payment_status"] == "cancelled"
    assert stats(client)["total_raised"] == 0
    assert client.post(f"{URL}/{donation_id}/confirm").status_code == 409


def test_same_transaction_cannot_be_declared_twice(client):
    assert declare(client).status_code == 201
    r = declare(client, transaction_ref="t-abc-12345")  # same reference, other case
    assert r.status_code == 409
    # Same reference on the other operator is a different transaction
    assert declare(client, payment_method="orange_money").status_code == 201


def test_declaration_validation(client):
    assert declare(client, amount=50).status_code == 400
    assert declare(client, payment_method="bitcoin").status_code == 422
    assert declare(client, transaction_ref="").status_code == 422
    assert declare(client, donor_phone="").status_code == 422
    assert declare(client, project_id=999999).status_code == 400


def test_only_admins_confirm_or_reject(client):
    donation_id = declare(client).json()["donation_id"]
    assert client.post(f"{URL}/{donation_id}/confirm").status_code == 401
    register(client, "curieux@example.com")
    login(client, "curieux@example.com")
    assert client.post(f"{URL}/{donation_id}/confirm").status_code == 403
    assert client.post(f"{URL}/{donation_id}/reject").status_code == 403
    assert db_fetch("SELECT payment_status FROM donations WHERE id = $1", donation_id)[0]["payment_status"] == "pending"


def test_online_payments_cannot_be_confirmed_by_hand(client, admin):
    # A normal (PayDunya) donation must not be confirmable through this route
    donation_id = db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, payment_provider) "
        "VALUES (5000, 'general', 'wave', 'pending', 'paydunya') RETURNING id"
    )[0]["id"]
    assert client.post(f"{URL}/{donation_id}/confirm").status_code == 404
