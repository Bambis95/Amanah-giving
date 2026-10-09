"""Treasurer and accountant: each entry validated by the other, monthly close, comments, shared to-do."""

from datetime import date, timedelta

from tests.conftest import login, register, set_role

LAST_MONTH = (date.today().replace(day=1) - timedelta(days=1))


def team(client):
    for email, role in (("tresorier@example.com", "treasurer"), ("compta@example.com", "accountant")):
        register(client, email)
        set_role(email, role)


def entry(client, **overrides):
    data = {"kind": "expense", "entry_date": LAST_MONTH.isoformat(), "amount": 150_000, "category": "equipment",
            "label": "Tables et bancs", "payment_method": "wave", **overrides}
    r = client.post("/api/v1/finance/entries", json=data)
    assert r.status_code == 201, r.text
    return r.json()


def test_nobody_validates_their_own_entry(client):
    team(client)
    login(client, "tresorier@example.com")
    e = entry(client)
    assert e["validated_at"] is None
    r = client.post(f"/api/v1/finance/entries/{e['id']}/validate")
    assert r.status_code == 403 and "autre personne" in r.json()["detail"]

    login(client, "compta@example.com")
    r = client.post(f"/api/v1/finance/entries/{e['id']}/validate")
    assert r.status_code == 200 and r.json()["validated_by_name"] == "Test"

    # Changing a validated entry sends it back for validation
    login(client, "tresorier@example.com")
    r = client.put(f"/api/v1/finance/entries/{e['id']}", json={**{k: e[k] for k in ("kind", "entry_date", "category", "label", "payment_method")}, "amount": 160_000})
    assert r.status_code == 200 and r.json()["validated_at"] is None


def test_shared_todo_and_comments(client):
    team(client)
    login(client, "tresorier@example.com")
    e = entry(client)
    todo = client.get("/api/v1/finance/todo").json()
    assert [t["id"] for t in todo["waiting_for_others"]] == [e["id"]] and todo["to_validate"] == []
    assert [t["id"] for t in todo["missing_receipts"]] == [e["id"]]

    login(client, "compta@example.com")
    assert [t["id"] for t in client.get("/api/v1/finance/todo").json()["to_validate"]] == [e["id"]]
    r = client.post(f"/api/v1/finance/entries/{e['id']}/comments", json={"body": "Le reçu est flou, peux-tu le renvoyer ?"})
    assert r.status_code == 201
    login(client, "tresorier@example.com")
    comments = client.get(f"/api/v1/finance/entries/{e['id']}/comments").json()
    assert [c["body"] for c in comments] == ["Le reçu est flou, peux-tu le renvoyer ?"]
    assert client.get("/api/v1/finance/entries").json()[0]["comments"] == 1


def test_month_close_by_the_accountant(client, admin):
    team(client)
    month = LAST_MONTH.strftime("%Y-%m")
    login(client, "tresorier@example.com")
    e = entry(client)
    assert client.post("/api/v1/finance/closures", json={"month": month}).status_code == 403  # not the treasurer

    login(client, "compta@example.com")
    r = client.post("/api/v1/finance/closures", json={"month": month})
    assert r.status_code == 409 and "attendent" in r.json()["detail"]  # an entry still waits
    client.post(f"/api/v1/finance/entries/{e['id']}/validate")
    assert client.post("/api/v1/finance/closures", json={"month": month}).status_code == 200
    assert client.post("/api/v1/finance/closures", json={"month": date.today().strftime("%Y-%m")}).status_code == 400

    # Closed: nothing can be added, changed or cancelled in that month
    login(client, "tresorier@example.com")
    r = client.post("/api/v1/finance/entries", json={"kind": "expense", "entry_date": LAST_MONTH.isoformat(), "amount": 1,
                                                     "category": "equipment", "label": "Oubli", "payment_method": "cash"})
    assert r.status_code == 409 and "clôturé" in r.json()["detail"]
    assert client.post(f"/api/v1/finance/entries/{e['id']}/cancel", json={"reason": "Erreur"}).status_code == 409

    # Only an admin reopens, and it is logged
    assert client.delete(f"/api/v1/finance/closures/{month}").status_code == 403
    login(client, "admin@example.com")
    assert client.delete(f"/api/v1/finance/closures/{month}").status_code == 200
    assert client.get("/api/v1/finance/closures").json() == []
