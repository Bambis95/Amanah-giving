"""Finances: who may read or write, entries and their cancellation, documents, budgets,
reconciliation of online donations, and the summary that ties them together."""

import io
from datetime import date, timedelta

import pytest
from PIL import Image

from tests.conftest import db_fetch, login, make_project, register, set_role

TODAY = date.today().isoformat()


def as_role(client, email, role):
    register(client, email)
    set_role(email, role)
    assert login(client, email).status_code == 200


@pytest.fixture
def treasurer(client):
    as_role(client, "tresorier@example.com", "treasurer")


def entry(client, **overrides):
    data = {
        "kind": "expense",
        "entry_date": TODAY,
        "amount": 150_000,
        "category": "equipment",
        "label": "Tables et bancs",
        "payment_method": "wave",
    }
    data.update(overrides)
    return client.post("/api/v1/finance/entries", json=data)


def paid_donation(amount=25_000, project_id=None, method="wave"):
    return db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, project_id, payment_reference) "
        "VALUES ($1, 'education', $2, 'paid', $3, 'REF') RETURNING id",
        amount, method, project_id,
    )[0]["id"]


# ---------- access ----------

def test_who_reads_and_who_writes(client):
    assert client.get("/api/v1/finance/summary").status_code == 401

    as_role(client, "membre@example.com", "member")
    assert client.get("/api/v1/finance/summary").status_code == 403

    as_role(client, "president@example.com", "president")
    assert client.get("/api/v1/finance/summary").status_code == 200
    assert entry(client).status_code == 403  # the president reads the accounts, does not keep them

    as_role(client, "tresorier@example.com", "treasurer")
    assert entry(client).status_code == 201
    # The treasurer does not run campaigns or accounts
    assert client.post("/api/v1/entities/projects", json={"title": "x", "description": "y", "category": "youth", "raised": 0, "goal": 1}).status_code == 403
    assert client.get("/api/v1/users").status_code == 403

    as_role(client, "admin2@example.com", "admin")
    assert entry(client).status_code == 201


def test_only_admins_name_a_treasurer(client, admin):
    register(client, "futur@example.com")
    uid = db_fetch("SELECT id FROM users WHERE email = 'futur@example.com'")[0]["id"]
    as_role(client, "president@example.com", "president")
    assert client.put(f"/api/v1/users/{uid}/role", json={"role": "treasurer"}).status_code == 403
    assert client.post("/api/v1/invitations", json={"email": "t@example.com", "role": "treasurer"}).status_code == 403
    login(client, "admin@example.com")
    assert client.put(f"/api/v1/users/{uid}/role", json={"role": "treasurer"}).json()["role"] == "treasurer"


# ---------- entries ----------

def test_entry_is_validated_edited_and_cancelled_never_deleted(client, treasurer):
    bad = [
        {"amount": 0},
        {"amount": -5},
        {"category": "grant"},  # an income category on an expense
        {"payment_method": "bitcoin"},
        {"entry_date": (date.today() + timedelta(days=2)).isoformat()},
        {"label": ""},
        {"project_id": 999999},
    ]
    for override in bad:
        assert entry(client, **override).status_code in (400, 422), override

    created = entry(client).json()
    assert created["created_by_name"] == "Test"
    r = client.put(f"/api/v1/finance/entries/{created['id']}", json={
        "kind": "expense", "entry_date": TODAY, "amount": 175_000, "category": "equipment",
        "label": "Tables, bancs et tableau", "payment_method": "cash", "reference": "FACT-12",
    })
    assert r.status_code == 200 and r.json()["amount"] == 175_000 and r.json()["updated_at"]

    assert client.post(f"/api/v1/finance/entries/{created['id']}/cancel", json={"reason": ""}).status_code == 422
    r = client.post(f"/api/v1/finance/entries/{created['id']}/cancel", json={"reason": "Saisie en double"})
    assert r.status_code == 200 and r.json()["cancel_reason"] == "Saisie en double"
    # Still listed (history), no longer editable
    assert [e["id"] for e in client.get("/api/v1/finance/entries").json()] == [created["id"]]
    assert client.put(f"/api/v1/finance/entries/{created['id']}", json={
        "kind": "expense", "entry_date": TODAY, "amount": 1, "category": "equipment", "label": "x", "payment_method": "cash",
    }).status_code == 409
    assert client.delete(f"/api/v1/finance/entries/{created['id']}").status_code == 405

    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs ORDER BY id")]
    assert actions == ["finance.entry_create", "finance.entry_update", "finance.entry_cancel"]


def test_supporting_documents_are_private(client, treasurer):
    photo = io.BytesIO()
    Image.new("RGB", (3000, 1000), (10, 20, 30)).save(photo, "JPEG")
    r = client.post("/api/v1/finance/documents", files={"file": ("facture.jpg", photo.getvalue(), "image/jpeg")})
    assert r.status_code == 201
    doc_id = r.json()["id"]
    pdf = client.post("/api/v1/finance/documents", files={"file": ("releve.pdf", b"%PDF-1.4 releve", "application/pdf")})
    assert pdf.json()["content_type"] == "application/pdf"
    assert client.post("/api/v1/finance/documents", files={"file": ("x.exe", b"MZ....", "application/octet-stream")}).status_code == 400

    assert entry(client, document_id=doc_id).json()["document_id"] == doc_id
    stored = client.get(f"/api/v1/finance/documents/{doc_id}")
    assert stored.status_code == 200 and Image.open(io.BytesIO(stored.content)).size == (2000, 667)

    client.cookies.clear()
    assert client.get(f"/api/v1/finance/documents/{doc_id}").status_code == 401
    as_role(client, "membre@example.com", "member")
    assert client.get(f"/api/v1/finance/documents/{doc_id}").status_code == 403


# ---------- budgets, reconciliation, summary ----------

def test_budget_reconciliation_and_summary(client, admin):
    project = make_project(client, title="École PANISED", goal=120_000_000)
    client.cookies.clear()
    as_role(client, "tresorier@example.com", "treasurer")

    lines = [
        {"label": "Construction des salles", "category": "construction", "planned_amount": 80_000_000},
        {"label": "Équipement des ateliers", "category": "equipment", "planned_amount": 40_000_000},
    ]
    r = client.put(f"/api/v1/finance/budgets/{project['id']}", json=lines)
    assert r.status_code == 200 and [l["label"] for l in r.json()] == ["Construction des salles", "Équipement des ateliers"]
    assert client.put(f"/api/v1/finance/budgets/{project['id']}", json=[{**lines[0], "category": "grant"}]).status_code == 422

    d1 = paid_donation(25_000, project["id"], "wave")
    paid_donation(10_000, None, "orange_money")
    db_fetch("INSERT INTO donations (amount, cause, payment_method, payment_status) VALUES (99999, 'x', 'wave', 'pending')")
    entry(client, kind="income", category="grant", amount=500_000, label="Subvention mairie", project_id=project["id"])
    entry(client, amount=200_000, project_id=project["id"])
    cancelled = entry(client, amount=1_000_000).json()
    client.post(f"/api/v1/finance/entries/{cancelled['id']}/cancel", json={"reason": "Erreur de montant"})

    # Reconciliation: tick one donation against the operator statement
    pending = client.get("/api/v1/finance/reconciliation").json()
    assert sorted(d["amount"] for d in pending) == [10_000, 25_000]
    assert client.post(f"/api/v1/finance/reconciliation/{d1}", json={"reconciled": True}).status_code == 200
    done = client.get("/api/v1/finance/reconciliation", params={"state": "done"}).json()
    assert [d["id"] for d in done] == [d1] and done[0]["reconciled_by_name"] == "Test"

    s = client.get("/api/v1/finance/summary", params={"year": date.today().year}).json()
    assert s["donations"]["total"] == 35_000 and s["donations"]["by_method"] == {"wave": 25_000, "orange_money": 10_000}
    assert s["other_income"] == 500_000
    assert s["expenses"] == 200_000  # the cancelled entry does not count
    assert s["balance"] == 35_000 + 500_000 - 200_000
    assert s["reconciliation"] == {"reconciled_total": 25_000, "reconciled_count": 1, "pending_total": 10_000, "pending_count": 1}
    month = s["months"][date.today().month - 1]
    assert month == {"month": date.today().month, "donations": 35_000, "other_income": 500_000, "expenses": 200_000}
    panised = next(p for p in s["projects"] if p["id"] == project["id"])
    assert panised == {
        "id": project["id"], "title": "École PANISED", "status": "active", "goal": 120_000_000,
        "received": 525_000, "spent": 200_000, "available": 325_000, "budget": 120_000_000,
    }

    # PDF report: one campaign, and the whole platform
    for params in ({"project_id": project["id"], "year": date.today().year}, {}):
        r = client.get("/api/v1/finance/reports/pdf", params=params)
        assert r.status_code == 200 and r.content.startswith(b"%PDF"), params
    assert client.get("/api/v1/finance/reports/pdf", params={"project_id": 999999}).status_code == 404

    # Public transparency: totals per category only, nothing private
    client.cookies.clear()
    public = client.get("/api/v1/transparency/spending").json()
    assert public["total_spent"] == 200_000
    assert public["by_category"] == {"Équipement et matériel": 200_000}
    row = next(p for p in public["projects"] if p["project_id"] == project["id"])
    assert row == {"project_id": project["id"], "spent": 200_000, "other_income": 500_000, "budget": 120_000_000,
                   "by_category": {"Équipement et matériel": 200_000}}
    assert "Tables et bancs" not in str(public) and "Subvention mairie" not in str(public)
    assert client.get("/api/v1/finance/reports/pdf").status_code == 401

    # Another year shows nothing
    login(client, "tresorier@example.com")
    empty = client.get("/api/v1/finance/summary", params={"year": 2001}).json()
    assert empty["balance"] == 0 and empty["donations"]["count"] == 0
