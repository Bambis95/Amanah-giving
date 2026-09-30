"""Newsletter: consent only, send to active subscribers, one-click unsubscribe."""

from tests.conftest import db_fetch, login, make_project, register, set_role
from tests.test_paytech import paytech_on  # noqa: F401  (fixture reused)

ISSUE = {"subject": "Les tables sont arrivées", "body": "Grâce à vous, 40 tables-bancs sont à Touba.\n\nMerci !"}


def notify(client, email, name="Awa"):
    r = client.post("/api/v1/entities/contact_messages", json={"name": name, "email": email, "phone": "+221 77 000 00 00", "subject": "notify", "message": "Tenez-moi informé"})
    assert r.status_code == 201


def donate(client, email, newsletter):
    return client.post("/api/v1/payment/create-checkout", json={
        "amount": 5000, "cause": "education", "payment_method": "wave",
        "donor_first_name": "Moussa", "donor_email": email, "newsletter": newsletter,
    })


def test_only_consenting_people_are_subscribed(client, paytech_on, sent_emails):
    notify(client, "Awa@Example.com")
    notify(client, "awa@example.com")  # twice = one subscriber
    assert donate(client, "moussa@example.com", True).status_code == 200
    assert donate(client, "sans-consentement@example.com", False).status_code == 200
    client.post("/api/v1/entities/contact_messages", json={"name": "X", "email": "question@example.com", "subject": "Question", "message": "Bonjour"})
    rows = db_fetch("SELECT email, source FROM newsletter_subscribers ORDER BY email")
    assert [(r["email"], r["source"]) for r in rows] == [("awa@example.com", "notify"), ("moussa@example.com", "donation")]


def test_send_reaches_active_subscribers_with_unsubscribe_link(client, admin, sent_emails):
    project = make_project(client, title="École PANISED")
    client.cookies.clear()
    notify(client, "awa@example.com")
    notify(client, "fatou@example.com", name="Fatou")
    token = db_fetch("SELECT token FROM newsletter_subscribers WHERE email = 'fatou@example.com'")[0]["token"]
    assert client.post("/api/v1/newsletter/unsubscribe", json={"token": token}).status_code == 200

    login(client, "admin@example.com")
    overview = client.get("/api/v1/newsletter/overview").json()
    assert overview["active"] == 1 and overview["unsubscribed"] == 1 and "awa@example.com" not in str(overview)

    assert client.post("/api/v1/newsletter/test", json=ISSUE).status_code == 200
    assert sent_emails[-1]["To"] == "admin@example.com" and sent_emails[-1]["Subject"].startswith("[Test]")

    sent_emails.clear()
    r = client.post("/api/v1/newsletter/send", json={**ISSUE, "project_id": project["id"]})
    assert r.status_code == 200 and r.json()["recipients"] == 1
    assert [m["To"] for m in sent_emails] == ["awa@example.com"]
    message = sent_emails[0]
    assert "desabonnement?token=" in message["List-Unsubscribe"]
    assert f"/projects?campagne={project['id']}" in message.get_body(("plain",)).get_content()
    assert client.get("/api/v1/newsletter/overview").json()["issues"][0]["recipients"] == 1


def test_resubscribing_and_rights(client, sent_emails):
    notify(client, "awa@example.com")
    token = db_fetch("SELECT token FROM newsletter_subscribers")[0]["token"]
    client.post("/api/v1/newsletter/unsubscribe", json={"token": token})
    notify(client, "awa@example.com")  # a new explicit request subscribes again
    assert db_fetch("SELECT unsubscribed_at FROM newsletter_subscribers")[0]["unsubscribed_at"] is None
    assert client.post("/api/v1/newsletter/unsubscribe", json={"token": "inconnu-inconnu"}).status_code == 200

    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")
    assert client.post("/api/v1/newsletter/send", json=ISSUE).status_code == 403
    assert client.get("/api/v1/newsletter/overview").status_code == 403
