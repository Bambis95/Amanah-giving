"""Donor wall (only donors who chose to appear) and campaign end date."""

from tests.conftest import db_fetch, make_project
from tests.test_paytech import paytech_on  # noqa: F401  (fixture reused)


def donate(client, project_id, first, last, amount, anonymous):
    r = client.post("/api/v1/payment/create-checkout", json={
        "amount": amount, "cause": "water", "project_id": project_id, "payment_method": "wave",
        "donor_first_name": first, "donor_last_name": last, "donor_email": f"{first.lower()}@example.com",
        "anonymous": anonymous,
    })
    assert r.status_code == 200, r.text
    return r.json()["donation_id"]


def test_wall_shows_only_paid_donors_who_chose_to_appear(client, admin, paytech_on):
    project = make_project(client)
    shown = donate(client, project["id"], "Awa", "diop", 5000, False)
    hidden = donate(client, project["id"], "Moussa", "Fall", 20000, True)
    donate(client, project["id"], "Pending", "X", 1000, False)  # never paid: not listed
    db_fetch("UPDATE donations SET payment_status = 'paid' WHERE id = ANY($1::int[]) RETURNING id", [shown, hidden])
    # An older donation, made before donors could choose: anonymous
    db_fetch("INSERT INTO donations (amount, cause, payment_method, payment_status, project_id, donor_first_name, donor_last_name) "
             "VALUES (3000, 'water', 'wave', 'paid', $1, 'Ancien', 'Donateur') RETURNING id", project["id"])

    client.cookies.clear()
    body = client.get(f"/api/v1/supporters/{project['id']}").json()
    assert body["total"] == 3
    named = [i for i in body["items"] if i["name"]]
    assert named == [{"name": "Awa D.", "amount": 5000, "created_at": named[0]["created_at"]}]
    assert all(i["amount"] is None for i in body["items"] if not i["name"])
    text = str(body)
    for secret in ("Moussa", "Fall", "Ancien", "20000", "example.com"):
        assert secret not in text


def test_paused_campaign_has_no_public_wall(client, admin):
    project = make_project(client, status="paused")
    client.cookies.clear()
    assert client.get(f"/api/v1/supporters/{project['id']}").status_code == 404


def test_end_date_is_set_and_removed(client, admin):
    project = make_project(client, end_date="2026-12-31")
    assert project["end_date"] == "2026-12-31"
    r = client.put(f"/api/v1/entities/projects/{project['id']}", json={"title": "Puits au village (phase 2)"})
    assert r.json()["end_date"] == "2026-12-31"  # untouched by other edits
    r = client.put(f"/api/v1/entities/projects/{project['id']}", json={"end_date": None})
    assert r.status_code == 200 and r.json()["end_date"] is None
