"""PayTech (Wave / Orange Money / card): checkout, HMAC-signed IPN and project totals, PayTech faked."""

import hashlib
import hmac
from types import SimpleNamespace

import pytest

import routers.payment_checkout as payment_checkout
from core.config import settings
from services import paytech
from tests.conftest import make_project
from tests.test_payments import checkout, donation, project_totals

API_KEY = "pt-test-key"
API_SECRET = "pt-test-secret"


@pytest.fixture
def paytech_on(monkeypatch):
    """PayTech selected, with test keys; payment requests are captured instead of sent."""
    monkeypatch.setattr(settings, "payment_provider", "paytech")
    monkeypatch.setattr(settings, "paytech_api_key", API_KEY)
    monkeypatch.setattr(settings, "paytech_api_secret", API_SECRET)
    state = SimpleNamespace(requests=[], fail=False)

    async def fake_create_payment(**kwargs):
        if state.fail:
            raise paytech.PayTechError("down")
        state.requests.append(kwargs)
        token = f"pt-{len(state.requests)}"
        return paytech.PayTechCheckout(token=token, redirect_url=f"https://paytech.sn/payment/checkout/{token}")

    monkeypatch.setattr(payment_checkout.paytech, "create_payment", fake_create_payment)
    return state


def ipn(client, ref, amount=5000, event="sale_complete", secret=API_SECRET, signed=True):
    fields = {
        "type_event": event,
        "ref_command": ref,
        "item_price": str(amount),
        "final_item_price": str(amount),
        "payment_method": "Wave",
        "env": "test",
    }
    if signed:
        message = f"{fields['final_item_price']}|{ref}|{API_KEY}"
        fields["hmac_compute"] = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return client.post("/api/v1/payment/paytech/ipn", data=fields)


def start(client, **data):
    r = checkout(client, **data)
    assert r.status_code == 200, r.text
    body = r.json()
    return body, donation(body["donation_id"])


def test_paytech_donation_is_credited_once(client, admin, paytech_on, sent_emails):
    project = make_project(client)
    client.cookies.clear()
    body, row = start(client, project_id=project["id"], payment_method="orange_money")

    assert body["checkout_url"].startswith("https://paytech.sn/payment/checkout/")
    request = paytech_on.requests[0]
    assert request["amount"] == 5000 and request["payment_method"] == "orange_money"
    assert request["success_url"].endswith(f"/payment/success?donation_id={row['id']}&provider=paytech")
    assert row["payment_provider"] == "paytech" and row["payment_status"] == "pending"
    assert row["payment_reference"] == request["ref_command"]

    # The return page alone never marks the donation paid
    assert client.post("/api/v1/payment/paytech/verify", json={"donation_id": row["id"]}).json()["payment_status"] == "pending"

    assert ipn(client, row["payment_reference"]).status_code == 200
    assert donation(row["id"])["payment_status"] == "paid"
    assert project_totals(project["id"]) == (5000, 1)
    assert len(sent_emails) == 1

    # PayTech may notify again: nothing is counted twice
    assert ipn(client, row["payment_reference"]).status_code == 200
    assert project_totals(project["id"]) == (5000, 1) and len(sent_emails) == 1
    assert client.post("/api/v1/payment/paytech/verify", json={"donation_id": row["id"]}).json()["payment_status"] == "paid"


def test_forged_or_wrong_amount_notifications_are_refused(client, paytech_on, sent_emails):
    _, row = start(client)
    ref = row["payment_reference"]
    assert ipn(client, ref, signed=False).status_code == 401
    assert ipn(client, ref, secret="not-our-secret").status_code == 401
    assert ipn(client, ref, amount=100).status_code == 400
    assert donation(row["id"])["payment_status"] == "pending" and not sent_emails


def test_legacy_sha256_notification_is_accepted(client, paytech_on, sent_emails):
    _, row = start(client)
    fields = {
        "type_event": "sale_complete",
        "ref_command": row["payment_reference"],
        "item_price": "5000",
        "final_item_price": "5000",
        "api_key_sha256": hashlib.sha256(API_KEY.encode()).hexdigest(),
        "api_secret_sha256": hashlib.sha256(API_SECRET.encode()).hexdigest(),
    }
    assert client.post("/api/v1/payment/paytech/ipn", data=fields).status_code == 200
    assert donation(row["id"])["payment_status"] == "paid"


def test_cancelled_payment_and_paid_is_final(client, paytech_on, sent_emails):
    _, row = start(client)
    assert ipn(client, row["payment_reference"], event="sale_canceled").status_code == 200
    assert donation(row["id"])["payment_status"] == "cancelled"

    _, paid = start(client)
    ipn(client, paid["payment_reference"])
    ipn(client, paid["payment_reference"], event="sale_canceled")
    assert donation(paid["id"])["payment_status"] == "paid"


def test_card_goes_through_paytech(client, paytech_on):
    _, row = start(client, payment_method="card")
    assert paytech_on.requests[0]["payment_method"] == "card" and row["payment_method"] == "card"


def test_paytech_unavailable_marks_donation_failed(client, paytech_on):
    paytech_on.fail = True
    r = checkout(client)
    assert r.status_code == 502
    assert "indisponible" in r.json()["detail"]


def test_ipn_is_ignored_without_keys(client, monkeypatch):
    monkeypatch.setattr(settings, "paytech_api_key", "")
    monkeypatch.setattr(settings, "paytech_api_secret", "")
    assert ipn(client, "SENJAPO-1-abcd").status_code == 401


def test_request_body_sent_to_paytech(monkeypatch):
    """What create_payment sends: amount in XOF, env, target method, our IPN URL."""
    monkeypatch.setattr(settings, "paytech_api_key", API_KEY)
    monkeypatch.setattr(settings, "paytech_api_secret", API_SECRET)
    monkeypatch.setattr(settings, "paytech_env", "prod")
    monkeypatch.setattr(settings, "paytech_ipn_url", "https://api.example.sn/api/v1/payment/paytech/ipn")
    sent = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"success": 1, "token": "t1", "redirect_url": "https://paytech.sn/payment/checkout/t1"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json, headers):
            sent.update(url=url, body=json, headers=headers)
            return FakeResponse()

    monkeypatch.setattr(paytech.httpx, "AsyncClient", FakeClient)
    import asyncio

    result = asyncio.run(
        paytech.create_payment(
            amount=5000, ref_command="SENJAPO-1-ab", item_name="Don", command_name="Don #1",
            success_url="https://s/ok", cancel_url="https://s/ko", payment_method="wave",
        )
    )
    assert result.redirect_url.endswith("/t1")
    assert sent["url"] == paytech.REQUEST_URL
    assert sent["headers"]["API_KEY"] == API_KEY and sent["headers"]["API_SECRET"] == API_SECRET
    body = sent["body"]
    assert body["item_price"] == 5000 and body["currency"] == "XOF" and body["env"] == "prod"
    assert body["target_payment"] == "Wave" and body["ipn_url"].endswith("/paytech/ipn")
