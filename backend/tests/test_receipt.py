"""Donation receipts: PDF attached to the thank-you email, downloadable by the donor and managers."""

from tests.conftest import db_fetch, login, make_project, register, set_role
from tests.test_paytech import ipn, paytech_on, start  # noqa: F401  (fixture reused)


def paid_donation(user_id=None, status="paid"):
    return db_fetch(
        "INSERT INTO donations (amount, cause, payment_method, payment_status, donor_first_name, donor_email, user_id) "
        "VALUES (25000, 'education', 'wave', $1, 'Awa', 'awa@example.com', $2) RETURNING id",
        status, user_id,
    )[0]["id"]


def receipt(client, donation_id):
    return client.get(f"/api/v1/entities/donations/{donation_id}/receipt")


def test_thank_you_email_carries_the_pdf_receipt(client, admin, paytech_on, sent_emails):
    project = make_project(client, title="École PANISED")
    client.cookies.clear()
    _, row = start(client, project_id=project["id"])
    ipn(client, row["payment_reference"])

    assert len(sent_emails) == 1
    attachments = list(sent_emails[0].iter_attachments())
    assert len(attachments) == 1
    pdf = attachments[0]
    assert pdf.get_content_type() == "application/pdf"
    assert pdf.get_filename() == f"recu-SENJAPO-{row['id']:06d}.pdf"
    assert pdf.get_content().startswith(b"%PDF")


def test_admin_and_president_download_receipts(client, admin):
    donation = paid_donation()
    r = receipt(client, donation)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and "attachment" in r.headers["content-disposition"]

    register(client, "president@example.com")
    set_role("president@example.com", "president")
    login(client, "president@example.com")
    assert receipt(client, donation).status_code == 200


def test_donor_gets_own_receipt_only(client):
    donor = register(client, "donateur@example.com")
    mine = paid_donation(user_id=donor["id"])
    other = paid_donation()
    login(client, "donateur@example.com")
    assert receipt(client, mine).status_code == 200
    assert receipt(client, other).status_code == 404

    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")  # members do not see donor contact details
    assert receipt(client, other).status_code == 404

    client.cookies.clear()
    assert receipt(client, mine).status_code == 401


def test_no_receipt_before_payment(client, admin):
    assert receipt(client, paid_donation(status="pending")).status_code == 409
    assert receipt(client, 999999).status_code == 404
