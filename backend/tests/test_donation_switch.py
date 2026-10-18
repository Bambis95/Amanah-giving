"""Opening and closing online donations from the dashboard, with the safety checks."""

import time

import pytest

import services.email
from core.config import settings
from services import alerts
from tests.conftest import db_fetch, login, register, set_role
from tests.test_payments import checkout, paydunya  # noqa: F401  (fixture reused)

URL = "/api/v1/site/donations-switch"


@pytest.fixture
def email_on(monkeypatch):
    monkeypatch.setattr(services.email, "email_enabled", lambda: True)
    alerts._last_sent.clear()


def wait_for(predicate, seconds=5.0):
    end = time.time() + seconds
    while time.time() < end:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def test_render_setting_decides_until_the_switch_is_used(client, admin, monkeypatch):
    monkeypatch.setattr(settings, "donations_enabled", False)
    state = client.get(URL).json()
    assert state["open"] is False and state["source"] == "render"
    assert client.get("/api/v1/site").json()["donations_enabled"] is False


def test_opening_is_refused_while_payments_are_in_test_mode(client, admin, monkeypatch):
    monkeypatch.setattr(settings, "donations_enabled", False)
    state = client.get(URL).json()
    assert state["can_open"] is False and "mode « test »" in state["blockers"][0]
    r = client.put(URL, json={"open": True})
    assert r.status_code == 409 and "test" in r.json()["detail"]
    assert client.get("/api/v1/site").json()["donations_enabled"] is False


def test_close_then_open_from_the_dashboard(client, admin, paydunya, sent_emails, email_on, monkeypatch):
    r = client.put(URL, json={"open": False, "reason": "Problème chez PayDunya"})
    assert r.status_code == 200 and r.json()["source"] == "admin" and r.json()["changed_by"] == "admin@example.com"
    assert client.get("/api/v1/site").json()["donations_enabled"] is False
    assert checkout(client).status_code == 503
    assert wait_for(lambda: any("Dons en ligne fermés" in m["Subject"] for m in sent_emails))
    assert "Problème chez PayDunya" in next(m for m in sent_emails if "fermés" in m["Subject"]).get_content()
    # The switch wins over Render from now on
    monkeypatch.setattr(settings, "donations_enabled", True)
    assert client.get("/api/v1/site").json()["donations_enabled"] is False

    monkeypatch.setattr(settings, "paydunya_mode", "live")
    assert client.put(URL, json={"open": True}).json()["open"] is True
    assert checkout(client).status_code == 200
    actions = [r["action"] for r in db_fetch("SELECT action FROM audit_logs WHERE action LIKE 'setting.donations%' ORDER BY id")]
    assert actions == ["setting.donations_closed", "setting.donations_open"]


def test_only_admins_switch(client, admin):
    register(client, "pres@example.com")
    set_role("pres@example.com", "president")
    login(client, "pres@example.com")
    assert client.get(URL).status_code == 200
    assert client.put(URL, json={"open": False}).status_code == 403

    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")
    assert client.get(URL).status_code == 403
