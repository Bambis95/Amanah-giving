"""Donations: checkout creation, payment confirmation (Stripe and PayDunya, both faked) and project totals."""

import hashlib
import json
from types import SimpleNamespace

import pytest

import routers.payment_checkout as payment_checkout
from services.paydunya import PayDunyaCheckout, PayDunyaError, PayDunyaInvoiceStatus
from services.payment import CheckoutError, CheckoutSessionResponse
from tests.conftest import db_fetch, login, make_project

DONOR = {"donor_first_name": "Awa", "donor_last_name": "Diop", "donor_email": "awa@example.com"}


@pytest.fixture
def paydunya(monkeypatch):
    """Fake PayDunya: invoices get token tok-<n>; `status` sets what the confirm call returns."""
    state = SimpleNamespace(created=[], status="completed", amount=None, fail_create=False, fail_confirm=False)

    def fake_create_checkout(**kwargs):
        if state.fail_create:
            raise PayDunyaError("down")
        state.created.append(kwargs)
        token = f"tok-{len(state.created)}"
        return PayDunyaCheckout(success=True, checkout_url=f"https://paydunya.test/checkout/{token}", token=token)

    async def fake_fetch_invoice_status(token):
        if state.fail_confirm:
            raise PayDunyaError("down")
        amount = state.amount if state.amount is not None else state.created[-1]["amount"]
        return PayDunyaInvoiceStatus(status=state.status, total_amount=amount)

    monkeypatch.setattr(payment_checkout, "create_checkout", fake_create_checkout)
    monkeypatch.setattr(payment_checkout, "fetch_invoice_status", fake_fetch_invoice_status)
    return state


@pytest.fixture
def stripe(monkeypatch):
    """Fake Stripe: sessions cs_<n>; `payment_status` sets what the verify call returns."""
    state = SimpleNamespace(sessions=[], payment_status="paid", fail=False)

    class FakePaymentService:
        async def create_checkout_session(self, request):
            if state.fail:
                raise CheckoutError("invalid key", error_type="authentication")
            state.sessions.append(request)
            sid = f"cs_{len(state.sessions)}"
            return CheckoutSessionResponse(url=f"https://stripe.test/{sid}", session_id=sid)

        async def get_checkout_status(self, session_id):
            return SimpleNamespace(status="complete", payment_status=state.payment_status)

    monkeypatch.setattr(payment_checkout, "PaymentService", FakePaymentService)
    return state


def checkout(client, **data):
    payload = {"amount": 5000, "cause": "education", "payment_method": "wave", **DONOR}
    payload.update(data)
    return client.post("/api/v1/payment/create-checkout", json=payload)


def ipn(client, token, status="completed", amount=5000, master_key="test-master-key"):
    data = {
        "hash": hashlib.sha512(master_key.encode()).hexdigest(),
        "status": status,
        "invoice": {"token": token, "total_amount": amount},
    }
    return client.post("/api/v1/payment/paydunya/ipn", data={"data": json.dumps(data)})


def donation(donation_id):
    return dict(db_fetch("SELECT * FROM donations WHERE id = $1", donation_id)[0])


def project_totals(project_id):
    row = db_fetch("SELECT raised, donors FROM projects WHERE id = $1", project_id)[0]
    return row["raised"], row["donors"]


# ---------- validation ----------

def test_anonymous_donation_requires_email(client, paydunya):
    r = checkout(client, donor_email=None)
    assert r.status_code == 400
    assert "email" in r.json()["detail"].lower()


def test_minimum_amount_and_unknown_method(client, paydunya):
    assert checkout(client, amount=499).status_code == 400
    assert checkout(client, payment_method="bitcoin").status_code == 400
    assert checkout(client, donor_email="pas-un-email").status_code == 422


def test_closed_or_missing_project_refuses_donations(client, admin, paydunya):
    closed = make_project(client, status="completed")
    client.cookies.clear()
    assert checkout(client, project_id=closed["id"]).status_code == 400
    assert checkout(client, project_id=999999).status_code == 400
    assert paydunya.created == []


# ---------- PayDunya (Wave / Orange Money) ----------

def test_paydunya_donation_is_credited_once(client, admin, paydunya, sent_emails):
    project = make_project(client)
    client.cookies.clear()

    r = checkout(client, project_id=project["id"], payment_method="orange_money")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["checkout_url"].startswith("https://paydunya.test/")
    d = donation(body["donation_id"])
    assert d["payment_status"] == "pending" and d["cause"] == "water" and d["user_id"] is None
    assert project_totals(project["id"]) == (0, 0)

    # The donor comes back: the return page asks PayDunya
    r = client.post("/api/v1/payment/paydunya/verify", json={"donation_id": body["donation_id"]})
    assert r.json()["payment_status"] == "paid"
    assert project_totals(project["id"]) == (5000, 1)
    assert len(sent_emails) == 1 and sent_emails[0]["To"] == "awa@example.com"

    # Late IPN and repeated checks change nothing
    assert ipn(client, body["session_id"]).json()["message"] == "Payment already processed"
    client.post("/api/v1/payment/paydunya/verify", json={"donation_id": body["donation_id"]})
    assert project_totals(project["id"]) == (5000, 1)
    assert len(sent_emails) == 1


def test_paydunya_ipn_marks_paid(client, paydunya, sent_emails):
    body = checkout(client).json()
    r = ipn(client, body["session_id"])
    assert r.status_code == 200 and r.json()["payment_status"] == "paid"
    assert donation(body["donation_id"])["payment_status"] == "paid"


def test_ipn_with_wrong_hash_is_rejected(client, paydunya):
    body = checkout(client).json()
    assert ipn(client, body["session_id"], master_key="fausse-cle").status_code == 401
    assert donation(body["donation_id"])["payment_status"] == "pending"


def test_ipn_with_wrong_amount_is_rejected(client, paydunya):
    body = checkout(client).json()
    assert ipn(client, body["session_id"], amount=100).status_code == 400
    assert donation(body["donation_id"])["payment_status"] == "pending"


def test_verify_with_wrong_amount_does_not_mark_paid(client, paydunya):
    body = checkout(client).json()
    paydunya.amount = 100
    r = client.post("/api/v1/payment/paydunya/verify", json={"donation_id": body["donation_id"]})
    assert r.json()["payment_status"] == "pending"


def test_cancelled_payment_is_not_credited(client, admin, paydunya):
    project = make_project(client)
    client.cookies.clear()
    body = checkout(client, project_id=project["id"]).json()
    paydunya.status = "cancelled"
    r = client.post("/api/v1/payment/paydunya/verify", json={"donation_id": body["donation_id"]})
    assert r.json()["payment_status"] == "cancelled"
    assert project_totals(project["id"]) == (0, 0)


def test_paydunya_unavailable(client, paydunya):
    body = checkout(client).json()
    paydunya.fail_confirm = True
    r = client.post("/api/v1/payment/paydunya/verify", json={"donation_id": body["donation_id"]})
    assert r.status_code == 200 and r.json()["payment_status"] == "pending"  # the page can retry

    paydunya.fail_create = True
    r = checkout(client)
    assert r.status_code == 502
    failed = db_fetch("SELECT payment_status FROM donations ORDER BY id DESC LIMIT 1")[0]
    assert failed["payment_status"] == "failed"


def test_verify_unknown_donation(client, paydunya):
    assert client.post("/api/v1/payment/paydunya/verify", json={"donation_id": 424242}).status_code == 404


def test_logged_in_donation_is_linked_to_account(client, user, paydunya):
    body = checkout(client, donor_email=None).json()
    assert donation(body["donation_id"])["user_id"] == user["id"]


# ---------- Stripe (card) ----------

def test_stripe_donation_is_credited_once(client, admin, stripe, sent_emails):
    project = make_project(client)
    client.cookies.clear()

    body = checkout(client, payment_method="card", project_id=project["id"], amount=6560).json()
    assert body["checkout_url"] == "https://stripe.test/cs_1"
    assert float(stripe.sessions[0].amount) == 10.0  # 6560 FCFA ~ 10 EUR

    for _ in range(2):
        r = client.post("/api/v1/payment/verify", json={"session_id": body["session_id"]})
        assert r.json()["payment_status"] == "paid"
    assert project_totals(project["id"]) == (6560, 1)
    assert len(sent_emails) == 1


def test_stripe_unavailable_gives_friendly_error(client, stripe):
    stripe.fail = True
    r = checkout(client, payment_method="card")
    assert r.status_code == 500
    assert "carte" in r.json()["detail"]
    assert db_fetch("SELECT count(*) AS n FROM donations")[0]["n"] == 0


# ---------- pre-launch mode ----------

def test_donations_closed_before_launch(client, paydunya, monkeypatch):
    from core.config import settings

    started = checkout(client).json()  # started before the switch

    monkeypatch.setattr(settings, "donations_enabled", False)
    assert client.get("/api/v1/site").json() == {"donations_enabled": False}
    r = checkout(client)
    assert r.status_code == 503
    assert "bientôt" in r.json()["detail"]
    assert paydunya.created and len(paydunya.created) == 1

    # A payment already under way can still be confirmed
    assert ipn(client, started["session_id"]).json()["payment_status"] == "paid"

    monkeypatch.setattr(settings, "donations_enabled", True)
    assert client.get("/api/v1/site").json() == {"donations_enabled": True}
    assert checkout(client).status_code == 200


# ---------- public statistics ----------

def test_stats_count_only_paid_donations(client, paydunya):
    paid = checkout(client).json()
    ipn(client, paid["session_id"])
    checkout(client, donor_email="autre@example.com")  # stays pending

    stats = client.get("/api/v1/stats").json()
    assert stats["total_raised"] == 5000
    assert stats["paid_donations"] == 1
    assert stats["donors"] == 1
