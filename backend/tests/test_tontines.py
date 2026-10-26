"""Tontines: who sees what, the daily sheet, deposits validated by another officer, balances and alerts."""

from datetime import date, timedelta

import pytest

from routers import tontines
from tests.conftest import db_fetch, login, register, set_role

URL = "/api/v1/tontines"
TODAY = date(2026, 10, 20)


@pytest.fixture(autouse=True)
def fixed_day(monkeypatch):
    monkeypatch.setattr(tontines, "today", lambda: TODAY)
    monkeypatch.setattr(tontines, "send_email", lambda message, context: None)  # receipts: see the mails fixture


def make_group(client, **overrides):
    payload = {
        "name": "Natt des femmes de Fahu", "kind": "savings", "amount": 500, "frequency": "daily",
        "bank_name": "Banque partenaire", "bank_account": "SN0123456789", "cash_alert_amount": 5000, "cash_alert_days": 7,
        "president_name": "Awa Sarr", "president_email": "awa@example.com", **overrides,
    }
    r = client.post(URL, json=payload)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def add(client, gid, name, email=None, role="member", joined="2026-10-01"):
    r = client.post(f"{URL}/{gid}/members", json={"name": name, "email": email, "role": role, "joined_at": joined})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def as_user(client, email, role="user"):
    register(client, email)
    if role != "user":
        set_role(email, role)
    assert login(client, email).status_code == 200


@pytest.fixture
def group(client, admin):
    """A savings group: Awa president, Fatou treasurer, Binta member (all with accounts)."""
    gid = make_group(client)
    add(client, gid, "Fatou Diop", "fatou@example.com", role="treasurer")
    add(client, gid, "Binta Ndiaye", "binta@example.com")
    add(client, gid, "Penda Fall")  # no account: the treasurer keeps her line
    return gid


def members(client, gid):
    return {m["name"]: m for m in client.get(f"{URL}/{gid}", params={"month": "2026-10"}).json()["members"]}


def test_others_cannot_see_a_group_and_bank_account_is_masked(client, admin):
    gid = make_group(client)
    data = client.get(f"{URL}/{gid}").json()
    assert data["group"]["bank_account"] == "•••• 6789" and data["role"] == "admin"
    as_user(client, "someone@example.com")
    assert client.get(f"{URL}/{gid}").status_code == 404  # not a member: the group does not exist for them
    assert client.get(URL).json()["groups"] == []


def test_daily_sheet_balances_and_member_view(client, group):
    as_user(client, "fatou@example.com")  # the treasurer: linked to her line by her email
    assert client.get(URL).json()["groups"][0]["my_role"] == "treasurer"
    ids = {m["name"]: m["id"] for m in client.get(f"{URL}/{group}/day", params={"day": "2026-10-19"}).json()["members"]}
    for day in ("2026-10-18", "2026-10-19"):
        r = client.post(f"{URL}/{group}/day", json={"op_date": day, "method": "cash", "member_ids": [ids["Binta Ndiaye"], ids["Penda Fall"]]})
        assert (r.json()["added"], r.json()["skipped"]) == (2, 0)
    # Ticking twice the same day adds nothing
    again = client.post(f"{URL}/{group}/day", json={"op_date": "2026-10-19", "member_ids": [ids["Binta Ndiaye"]]})
    assert (again.json()["added"], again.json()["skipped"]) == (0, 1)
    assert client.post(f"{URL}/{group}/day", json={"op_date": "2026-10-21", "member_ids": [ids["Binta Ndiaye"]]}).status_code == 400

    rows = members(client, group)
    binta = rows["Binta Ndiaye"]
    assert (binta["contributed"], binta["paid_count"], binta["expected_count"]) == (1000, 2, 20)  # 1 to 20 October
    assert binta["late"] == 20 * 500 - 1000 and binta["to_receive"] == 1000
    summary = client.get(f"{URL}/{group}").json()["summary"]
    assert summary["cash_in_hand"] == 2000 and summary["bank_balance"] == 0

    # Binta sees her own line and nothing about the others
    as_user(client, "binta@example.com")
    view = client.get(f"{URL}/{group}", params={"month": "2026-10"}).json()
    assert view["role"] == "member" and view["me"]["contributed"] == 1000
    assert "members" not in view and "summary" not in view
    assert all(o["member_id"] == binta["id"] for o in view["my_operations"])
    assert client.get(f"{URL}/{group}/day").status_code == 403
    assert client.post(f"{URL}/{group}/operations", json={
        "kind": "deposit", "op_date": "2026-10-19", "amount": 1000, "method": "bank_transfer"}).status_code == 403


def test_deposit_counts_once_validated_by_another_officer(client, group):
    as_user(client, "fatou@example.com")
    pid = members(client, group)["Penda Fall"]["id"]
    client.post(f"{URL}/{group}/operations", json={"kind": "contribution", "member_id": pid, "op_date": "2026-10-02",
                                                   "amount": 9000, "method": "wave"})
    deposit = client.post(f"{URL}/{group}/operations", json={
        "kind": "deposit", "op_date": "2026-10-19", "amount": 9000, "method": "bank_transfer", "reference": "BRD-778"}).json()["id"]
    summary = client.get(f"{URL}/{group}").json()["summary"]
    assert (summary["cash_in_hand"], summary["bank_balance"], summary["pending_validation"]) == (0, 0, 1)
    assert client.post(f"{URL}/{group}/operations/{deposit}/validate").status_code == 403  # not her own

    as_user(client, "awa@example.com")  # the president validates
    assert client.post(f"{URL}/{group}/operations/{deposit}/validate").status_code == 200
    assert client.get(f"{URL}/{group}").json()["summary"]["bank_balance"] == 9000
    # A validated operation is cancelled by the president only, with a reason, and never deleted
    assert client.post(f"{URL}/{group}/operations/{deposit}/cancel", json={"reason": "Bordereau d'un autre groupe"}).status_code == 200
    assert client.get(f"{URL}/{group}").json()["summary"]["bank_balance"] == 0
    assert db_fetch("SELECT count(*) AS n FROM tontine_operations")[0]["n"] == 2
    actions = [r["action"] for r in db_fetch("SELECT action FROM audit_logs WHERE action LIKE 'tontine.%' ORDER BY id")]
    assert {"tontine.deposit", "tontine.validate", "tontine.cancel"} <= set(actions)


def test_cash_kept_too_long_raises_an_alert(client, group):
    as_user(client, "fatou@example.com")
    pid = members(client, group)["Penda Fall"]["id"]
    client.post(f"{URL}/{group}/operations", json={"kind": "contribution", "member_id": pid, "op_date": "2026-10-05",
                                                   "amount": 6000, "method": "cash"})
    codes = [a["code"] for a in client.get(f"{URL}/{group}").json()["summary"]["alerts"]]
    assert "cash_dormant" in codes  # 6 000 F in hand for 15 days, threshold 5 000 F / 7 days


def test_rotating_group_turn_order(client, admin):
    gid = make_group(client, kind="rotating", amount=10_000, frequency="monthly", name="Natt mensuelle")
    for name in ("Khady", "Mame", "Ndeye"):
        add(client, gid, name)
    view = client.get(f"{URL}/{gid}").json()
    rotation = view["summary"]["rotation"]
    assert rotation["pot"] == 40_000 and rotation["next"]["name"] == "Awa Sarr"
    awa = rotation["order"][0]["id"]
    r = client.post(f"{URL}/{gid}/operations", json={"kind": "payout", "member_id": awa, "op_date": "2026-10-10",
                                                     "amount": 40_000, "method": "cash", "source": "cash"})
    assert r.status_code == 201
    assert client.get(f"{URL}/{gid}").json()["summary"]["rotation"]["next"]["name"] == "Khady"


def test_member_roles_are_the_presidents(client, group):
    as_user(client, "fatou@example.com")
    assert client.post(f"{URL}/{group}/members", json={"name": "Nouvelle", "role": "treasurer"}).status_code == 403
    assert add(client, group, "Nouvelle membre")
    binta = members(client, group)["Binta Ndiaye"]["id"]
    assert client.put(f"{URL}/{group}/members/{binta}", json={"name": "Binta Ndiaye", "role": "president"}).status_code == 403


@pytest.fixture
def mails(monkeypatch):
    """Receipts and alerts captured instead of sent."""
    import services.email

    sent = []
    monkeypatch.setattr(tontines, "send_email", lambda message, context: sent.append(message))
    monkeypatch.setattr(services.email, "deliver", lambda message, context: sent.append(message) or True)
    monkeypatch.setattr(services.email, "email_enabled", lambda: True)
    return sent


def premium(client, gid, months=1):
    r = client.post(f"{URL}/{gid}/premium", json={"months": months})
    assert r.status_code == 200, r.text
    return r.json()


def test_receipts_reach_members_who_have_an_email(client, group, mails):
    premium(client, group)  # the admin, still signed in, records the day
    ids = {m["name"]: m["id"] for m in client.get(f"{URL}/{group}/day", params={"day": "2026-10-19"}).json()["members"]}
    r = client.post(f"{URL}/{group}/day", json={"op_date": "2026-10-19", "member_ids": [ids["Binta Ndiaye"], ids["Penda Fall"]]})
    assert r.json()["receipts"] == 1  # Penda has no email
    [receipt] = mails
    assert receipt["To"] == "binta@example.com" and "Natt des femmes de Fahu" in receipt["Subject"]
    assert "500 F" in receipt.get_content() and "Penda" not in receipt.get_content()


def test_mbootaay_aids_need_an_event(client, admin, mails):
    gid = make_group(client, kind="mbootaay", amount=2000, frequency="monthly", name="Mbootaay des grandes dames")
    premium(client, gid)
    khady = add(client, gid, "Khady Sow", "khady@example.com")
    client.post(f"{URL}/{gid}/operations", json={"kind": "contribution", "member_id": khady, "op_date": "2026-10-03",
                                                 "amount": 20000, "method": "cash"})
    aid = {"kind": "payout", "member_id": khady, "op_date": "2026-10-12", "amount": 15000, "method": "wave", "source": "cash"}
    assert client.post(f"{URL}/{gid}/operations", json=aid).status_code == 400
    r = client.post(f"{URL}/{gid}/operations", json={**aid, "category": "birth", "note": "Baptême de sa fille"})
    assert r.status_code == 201
    summary = client.get(f"{URL}/{gid}").json()["summary"]
    assert summary["month_aids"]["birth"] == 15000 and summary["fund"] == 5000
    assert any("Naissance" in m.get_content() for m in mails)  # the receipt names the event


def test_monthly_statement_pdf(client, group):
    assert client.get(f"{URL}/{group}/statement.pdf").status_code == 402  # Premium only
    premium(client, group)
    r = client.get(f"{URL}/{group}/statement.pdf", params={"month": "2026-10"})
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    as_user(client, "binta@example.com")
    assert client.get(f"{URL}/{group}/statement.pdf").status_code == 403


def test_dormant_cash_is_emailed_to_the_officers_every_three_days(client, group, mails):
    from services.tontine_mail import notify_dormant_cash
    from core.database import db_manager

    premium(client, group)
    pid = members(client, group)["Penda Fall"]["id"]
    client.post(f"{URL}/{group}/operations", json={"kind": "contribution", "member_id": pid, "op_date": "2026-10-05",
                                                   "amount": 6000, "method": "cash"})

    async def run():
        async with db_manager.async_session_maker() as db:
            return await notify_dormant_cash(db, TODAY)

    assert client.portal.call(run) == 1
    assert sorted(m["To"] for m in mails) == ["awa@example.com", "fatou@example.com"]
    assert client.portal.call(run) == 0  # not again before 3 days


def test_anyone_creates_one_free_group_and_becomes_its_president(client):
    as_user(client, "mame@example.com")
    payload = {"name": "Natt de Mame", "kind": "rotating", "amount": 5000, "frequency": "monthly"}
    assert client.post(URL, json=payload).status_code == 400  # the charter first
    r = client.post(URL, json={**payload, "accept_charter": True})
    assert r.status_code == 201 and r.json()["premium"] is False and r.json()["verified"] is False
    gid = r.json()["id"]
    view = client.get(f"{URL}/{gid}").json()
    assert view["role"] == "president" and view["members"][0]["email"] == "mame@example.com"
    # A second free group is refused
    assert client.post(URL, json={**payload, "name": "Deuxième", "accept_charter": True}).status_code == 402
    # The club's oversight is not hers
    assert client.get(f"{URL}/admin/all").status_code == 403
    assert client.post(f"{URL}/{gid}/premium", json={"months": 1}).status_code == 403


def test_club_grants_premium_verifies_and_suspends(client, admin):
    as_user(client, "mame@example.com")
    gid = client.post(URL, json={"name": "Natt de Mame", "kind": "savings", "amount": 500, "frequency": "daily", "accept_charter": True}).json()["id"]

    assert login(client, "admin@example.com").status_code == 200
    assert client.post(f"{URL}/{gid}/verify", json={"verified": True}).status_code == 402  # Premium first
    assert premium(client, gid, 1)["premium_until"] == str(TODAY + timedelta(days=30))
    assert premium(client, gid, 1)["premium_until"] == str(TODAY + timedelta(days=60))  # adds to the current period
    assert client.post(f"{URL}/{gid}/verify", json={"verified": True}).json()["verified"] is True
    listed = {g["id"]: g for g in client.get(f"{URL}/admin/all").json()}
    assert listed[gid]["premium"] and listed[gid]["president_contact"] == "mame@example.com"

    # Premium: the authenticator app is recommended, not required, to record
    assert login(client, "mame@example.com").status_code == 200
    me = client.get(f"{URL}/{gid}").json()["members"][0]["id"]
    r = client.post(f"{URL}/{gid}/operations", json={"kind": "contribution", "member_id": me, "op_date": "2026-10-19", "amount": 500})
    assert r.status_code == 201

    # Suspended: nothing can be recorded, the reason is shown
    assert login(client, "admin@example.com").status_code == 200
    assert client.post(f"{URL}/{gid}/suspend", json={"suspended": True, "reason": "Plaintes de membres"}).status_code == 200
    r = client.post(f"{URL}/{gid}/operations", json={"kind": "contribution", "member_id": me, "op_date": "2026-10-19", "amount": 500})
    assert r.status_code == 423
    actions = {r["action"] for r in db_fetch("SELECT action FROM audit_logs WHERE action LIKE 'tontine.%'")}
    assert {"tontine.premium", "tontine.verify", "tontine.suspend"} <= actions


def test_members_report_their_group(client, group):
    as_user(client, "binta@example.com")
    assert client.post(f"{URL}/{group}/report", json={"reason": "La trésorière ne dépose plus l'argent"}).status_code == 201
    [incident] = db_fetch("SELECT * FROM system_incidents WHERE kind = 'report'")
    assert "Natt des femmes de Fahu" in incident["title"] and "binta@example.com" in incident["detail"]
