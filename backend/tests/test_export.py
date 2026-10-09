"""Full data export: administrators only, every table, files included, no secrets."""

import io
import zipfile

from tests.conftest import db_fetch, login, make_project, register, set_role
from tests.test_images import photo, upload


def test_admin_downloads_everything_without_secrets(client, admin):
    make_project(client, title="École PANISED")
    image_id = upload(client, photo(800, 600)).json()["id"]
    r = client.get("/api/v1/admin/export")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/zip"
    assert "senjapo-export-" in r.headers["content-disposition"]

    archive = zipfile.ZipFile(io.BytesIO(r.content))
    names = archive.namelist()
    for table in ("campagnes", "dons", "comptes", "finances_ecritures", "newsletter_abonnes", "journal"):
        assert f"{table}.csv" in names
    assert any(n.startswith(f"fichiers/photos/{image_id}.") for n in names)
    assert "École PANISED" in archive.read("campagnes.csv").decode("utf-8-sig")

    accounts = archive.read("comptes.csv").decode("utf-8-sig")
    assert "admin@example.com" in accounts
    assert "password_hash" not in accounts and "$2" not in accounts and "token_version" not in accounts
    assert "token" not in archive.read("newsletter_abonnes.csv").decode("utf-8-sig").splitlines()[0].split(";")

    assert db_fetch("SELECT action FROM audit_logs WHERE action = 'security.data_export'")


def test_only_administrators_and_the_president_can_export(client):
    assert client.get("/api/v1/admin/export").status_code == 401
    register(client, "pres@example.com")
    set_role("pres@example.com", "president")
    login(client, "pres@example.com")
    assert client.get("/api/v1/admin/export").status_code == 200  # the client's legal representative
    for role in ("user", "treasurer", "accountant"):
        email = f"{role}@example.com"
        register(client, email)
        set_role(email, role)
        login(client, email)
        assert client.get("/api/v1/admin/export").status_code == 403, role
