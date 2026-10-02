"""Admin alerts when payments fail, and the automatic backup emailed to the administrators."""

import asyncio
import io
import time
import zipfile
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import services.email
from services import alerts, backup
from tests.conftest import TEST_DATABASE_URL, db_fetch
from tests.test_paytech import paytech_on  # noqa: F401  (fixture reused)


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


def donate(client):
    return client.post("/api/v1/payment/create-checkout", json={
        "amount": 5000, "cause": "general", "payment_method": "wave", "donor_email": "awa@example.com",
    })


def test_payment_failure_alerts_admins_once_per_hour(client, admin, paytech_on, sent_emails, email_on):
    paytech_on.fail = True
    client.cookies.clear()
    assert donate(client).status_code == 502
    assert wait_for(lambda: any("PayTech" in m["Subject"] for m in sent_emails))
    alert = next(m for m in sent_emails if "PayTech" in m["Subject"])
    assert alert["To"] == "admin@example.com"
    assert "awa@example.com" not in alert.get_content()  # no donor data in the alert

    assert donate(client).status_code == 502
    time.sleep(0.3)
    assert sum("PayTech" in m["Subject"] for m in sent_emails) == 1


async def _run_backup(now):
    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as db:
            return await backup.send_backup_if_due(db, now)
    finally:
        await engine.dispose()


def test_backup_is_emailed_every_week_without_secrets(client, admin, sent_emails, email_on):
    now = datetime(2026, 10, 1, 8, tzinfo=timezone.utc)
    assert asyncio.run(_run_backup(now)) is True
    message = sent_emails[-1]
    assert message["To"] == "admin@example.com" and "Sauvegarde automatique" in message["Subject"]
    attachment = next(message.iter_attachments())
    archive = zipfile.ZipFile(io.BytesIO(attachment.get_content()))
    assert "dons.csv" in archive.namelist() and not any(n.startswith("fichiers/") for n in archive.namelist())
    assert "password_hash" not in archive.read("comptes.csv").decode("utf-8-sig")

    sent_emails.clear()
    assert asyncio.run(_run_backup(now + timedelta(days=3))) is False  # not due yet
    assert asyncio.run(_run_backup(now + timedelta(days=7))) is True
    assert db_fetch("SELECT count(*) AS n FROM audit_logs WHERE action = 'security.backup_email'")[0]["n"] == 2


def test_full_health_check(client):
    r = client.get("/health/full")
    assert r.status_code == 200 and r.json()["status"] == "healthy"
    assert client.head("/health/full").status_code == 200  # monitors often use HEAD
