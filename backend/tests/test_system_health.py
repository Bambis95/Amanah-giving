"""Santé du système: crashes become incidents emailed to the admins, the watchdog, capacity, browser errors."""

import json
import time
from datetime import datetime, timedelta, timezone

import pytest

import services.email
from main import app
from services import alerts, monitoring
from tests.conftest import db_fetch, login, register, set_role

URL = "/api/v1/admin/system"


@pytest.fixture
def email_on(monkeypatch):
    monkeypatch.setattr(services.email, "email_enabled", lambda: True)
    alerts._last_sent.clear()


@pytest.fixture
def fresh():
    monitoring.metrics.reset()
    monitoring.watch.db_down_since = None
    monitoring.watch.emails_seen = services.email.recent_failures[-1][0] if services.email.recent_failures else 0
    monitoring._client_reports.clear()


async def _boom():
    raise KeyError("montant")


app.add_api_route("/api/v1/test-boom", _boom, methods=["GET"])


def wait_for(predicate, seconds=5.0):
    end = time.time() + seconds
    while time.time() < end:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def incidents(kind=None):
    rows = db_fetch("SELECT * FROM system_incidents ORDER BY id")
    return [r for r in rows if kind is None or r["kind"] == kind]


def test_crash_becomes_one_incident_emailed_once(client, admin, sent_emails, email_on, fresh):
    for _ in range(2):
        with pytest.raises(KeyError):  # the test client re-raises; visitors get a plain 500
            client.get("/api/v1/test-boom")
    [row] = incidents("error")
    assert row["count"] == 2 and row["severity"] == "critical"
    assert row["title"] == "Erreur KeyError sur GET /api/v1/test-boom"
    assert "montant" in row["detail"]
    assert wait_for(lambda: any("Panne" in m["Subject"] for m in sent_emails))
    time.sleep(0.2)
    assert sum("KeyError" in m["Subject"] for m in sent_emails) == 1

    listed = client.get(f"{URL}/incidents").json()
    assert listed["open_count"] == 1 and listed["items"][0]["kind_label"] == "Erreur du serveur"
    stats = client.get(URL).json()
    assert stats["incidents"]["critical"] == 1 and stats["status"] == "critical"
    assert stats["traffic"]["last_5m"]["server_errors"] == 2

    r = client.post(f"{URL}/incidents/{row['id']}/resolve", json={"note": "Corrigé dans la version 1.2"})
    assert r.status_code == 200 and r.json()["resolved_by_name"] == "admin@example.com"
    assert client.get(f"{URL}/incidents").json()["open_count"] == 0
    assert db_fetch("SELECT count(*) AS n FROM audit_logs WHERE action = 'system.incident_resolved'")[0]["n"] == 1

    # Happening again after the fix: a new incident
    with pytest.raises(KeyError):
        client.get("/api/v1/test-boom")
    assert [r["count"] for r in incidents("error")] == [2, 1]


def test_requests_are_counted_by_route_template(client, admin, fresh):
    client.get("/health")  # health checks of Render and GitHub are not visitors
    client.get("/api/v1/site")
    client.get("/api/v1/entities/projects/999999")
    data = client.get(URL).json()
    routes = {r["route"] for r in data["slow_routes"]} | set(monitoring.metrics.routes)
    assert "GET /api/v1/site" in routes and "GET /health" not in routes
    assert not any("999999" in r for r in routes)  # never the real address
    assert data["traffic"]["last_5m"]["requests"] >= 2 and data["traffic"]["last_5m"]["p95_ms"]
    assert len(data["hourly"]) == 24


def test_status_checks_and_capacity(client, admin, fresh):
    data = client.get(URL).json()
    checks = {c["id"]: c for c in data["checks"]}
    assert {"database", "email", "payment", "backup", "2fa", "https", "owner"} <= set(checks)
    assert checks["database"]["status"] == "ok" and data["database"]["ok"]
    assert checks["2fa"]["status"] == "warning"  # REQUIRE_2FA_FOR_TEAM=false in the tests
    cap = data["capacity"]
    assert cap["cpu_limit"] == 0.5 and not cap["measured"]
    # 0.5 CPU × 70 % / 25 ms = 14 requests per second
    assert cap["max_requests_per_second"] == 14.0 and cap["visitors_at_once"] == 280
    assert data["resources"]["memory"]["limit_mb"] == 512


def test_who_sees_and_who_resolves(client, admin, fresh):
    monitoring.metrics.reset()
    with pytest.raises(KeyError):
        client.get("/api/v1/test-boom")
    incident = incidents("error")[0]["id"]

    register(client, "pres@example.com")
    set_role("pres@example.com", "president")
    login(client, "pres@example.com")
    assert client.get(URL).status_code == 200
    assert client.post(f"{URL}/incidents/{incident}/resolve", json={}).status_code == 403
    assert client.post(f"{URL}/test-alert").status_code == 403

    register(client, "treso@example.com")
    set_role("treso@example.com", "treasurer")
    login(client, "treso@example.com")
    assert client.get(URL).status_code == 403


def test_browser_errors_are_recorded_without_tokens_and_rate_limited(client, sent_emails, email_on, fresh):
    body = {"message": "TypeError: x is undefined", "stack": "TypeError\n  at Donate (app.js:1:2)", "page": "/reset-password?token=SECRET#a"}
    assert client.post("/api/v1/monitoring/client-error", json=body).status_code == 204
    [row] = incidents("client")
    assert row["path"] == "/reset-password" and "SECRET" not in row["detail"]
    assert row["emailed_at"] is None
    assert client.post("/api/v1/monitoring/client-error", json={**body, "message": "ResizeObserver loop limit exceeded"}).status_code == 204
    assert len(incidents("client")) == 1  # browser noise ignored

    for _ in range(30):
        client.post("/api/v1/monitoring/client-error", json=body)
    assert incidents("client")[0]["count"] == monitoring.CLIENT_PER_IP_PER_HOUR
    time.sleep(0.2)
    assert not any("navigateur" in m["Subject"] for m in sent_emails)


def test_watchdog_opens_and_closes_conditions(client, admin, sent_emails, email_on, fresh, monkeypatch):
    monkeypatch.setattr(monitoring, "memory", lambda: {"used_mb": 470, "limit_mb": 512, "percent": 91.8})
    client.portal.call(monitoring.check_once)
    [row] = incidents("memory")
    assert row["title"] == "Mémoire du serveur presque pleine" and row["resolved_at"] is None
    assert wait_for(lambda: any("Mémoire" in m["Subject"] for m in sent_emails))

    monkeypatch.setattr(monitoring, "memory", lambda: {"used_mb": 200, "limit_mb": 512, "percent": 39.0})
    client.portal.call(monitoring.check_once)
    [row] = incidents("memory")
    assert row["resolved_at"] is not None and row["resolution_note"] == "Rétabli automatiquement"


def test_watchdog_reports_email_failures_and_database_outage(client, admin, fresh):
    services.email._note("login code", OSError("535 Username and Password not accepted"))
    monitoring.watch.db_down_since = datetime.now(timezone.utc) - timedelta(minutes=12)
    client.portal.call(monitoring.check_once)
    [mail_row] = incidents("email")
    assert "535" in mail_row["detail"] and mail_row["emailed_at"] is None  # not emailed: email is the problem
    [db_row] = incidents("database")
    assert db_row["title"] == "La base de données n'a pas répondu" and "12 min" in db_row["detail"]
    client.portal.call(monitoring.check_once)
    assert incidents("email")[0]["count"] == 1  # the same failure is not counted twice


def test_unexpected_stop_of_another_server_is_reported(client, admin, fresh):
    old = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()
    state = {"dead1": {"started_at": old, "heartbeat": old, "clean": False}, "gone": {"heartbeat": old, "clean": True}}
    db_fetch(
        "INSERT INTO site_settings (key, value, updated_at) VALUES ('server_instances', $1::json, now()) RETURNING key",
        json.dumps(state),
    )
    client.portal.call(monitoring.check_once)
    [row] = incidents("restart")
    assert row["title"] == "Le serveur s'est arrêté brusquement"
    saved = json.loads(db_fetch("SELECT value FROM site_settings WHERE key = 'server_instances'")[0]["value"])
    assert set(saved) == {monitoring.INSTANCE_ID}


def test_resolve_all_and_test_alert(client, admin, sent_emails, email_on, fresh):
    with pytest.raises(KeyError):
        client.get("/api/v1/test-boom")
    client.post("/api/v1/monitoring/client-error", json={"message": "Boom", "stack": "", "page": "/"})
    assert client.post(f"{URL}/incidents/resolve-all", json={"note": "Nouvelle version"}).json() == {"resolved": 2}
    assert client.get(f"{URL}/incidents", params={"status": "resolved"}).json()["items"][0]["resolution_note"] == "Nouvelle version"

    r = client.post(f"{URL}/test-alert")
    assert r.status_code == 200 and r.json()["sent_to"] == ["admin@example.com"]
    assert any("Alerte de test" in m["Subject"] for m in sent_emails)


def test_failed_test_alert_says_what_to_fix(client, admin, email_on, monkeypatch):
    def refuse(message, context):
        services.email._note(context, OSError("(535, b'5.7.8 Username and Password not accepted. BadCredentials')"))
        return False

    monkeypatch.setattr(services.email, "deliver", refuse)
    r = client.post(f"{URL}/test-alert")
    assert r.status_code == 502
    assert "mot de passe d'application" in r.json()["detail"] and "535" in r.json()["detail"]
