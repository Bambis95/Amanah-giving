"""Membership fees paid online: the admin-set amount only, counted apart from donations."""

from datetime import date

from tests.conftest import login
from tests.test_paytech import ipn, paytech_on  # noqa: F401  (fixture reused)

DONOR = {"donor_first_name": "Awa", "donor_last_name": "Diop", "donor_email": "awa@example.com"}


def pay_fee(client, amount):
    return client.post("/api/v1/payment/create-checkout", json={"amount": amount, "cause": "membership", "payment_method": "wave", **DONOR})


def set_fee(client, fee):
    settings = client.get("/api/v1/site/settings").json()
    assert client.put("/api/v1/site/settings", json={**settings, "membership_fee": fee}).status_code == 200


def test_fee_is_closed_until_an_amount_is_set(client, admin, paytech_on):
    client.cookies.clear()
    r = pay_fee(client, 5000)
    assert r.status_code == 400 and "pas encore ouvert" in r.json()["detail"]


def test_fee_amount_is_enforced_and_counted_apart(client, admin, paytech_on, sent_emails):
    set_fee(client, 10_000)
    client.cookies.clear()
    assert pay_fee(client, 5_000).status_code == 400
    r = pay_fee(client, 10_000)
    assert r.status_code == 200, r.text
    ref = paytech_on.requests[0]["ref_command"]
    assert ipn(client, ref, amount=10_000).status_code == 200

    # The thank-you email and receipt speak of a membership fee
    assert "cotisation" in sent_emails[0]["Subject"]
    pdf = next(sent_emails[0].iter_attachments()).get_content()
    assert pdf.startswith(b"%PDF")

    # Not a donation for the public figures…
    assert client.get("/api/v1/stats").json()["total_raised"] == 0
    # …but income of the club in the accounts, to tick like any online payment
    login(client, "admin@example.com")
    s = client.get("/api/v1/finance/summary", params={"year": date.today().year}).json()
    assert s["donations"]["total"] == 0
    assert s["by_category"]["income"] == {"membership_online": 10_000} and s["other_income"] == 10_000
    assert s["balance"] == 10_000
    assert s["reconciliation"]["pending_count"] == 1
    row = client.get("/api/v1/finance/reconciliation").json()[0]
    assert row["project_title"] == "Cotisation au club"
    assert client.get("/api/v1/finance/reports/pdf").status_code == 200


def test_fee_cannot_target_a_campaign(client, admin, paytech_on):
    set_fee(client, 10_000)
    client.cookies.clear()
    r = client.post("/api/v1/payment/create-checkout", json={"amount": 10_000, "cause": "membership", "project_id": 1, "payment_method": "wave", **DONOR})
    assert r.status_code == 400
