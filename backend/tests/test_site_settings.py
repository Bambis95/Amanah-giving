"""Site settings: defaults until an admin edits them, validated, admins only, logged."""

from tests.conftest import db_fetch, login, register, set_role

URL = "/api/v1/site/settings"


def test_defaults_then_admin_edit(client, admin):
    client.cookies.clear()
    defaults = client.get(URL).json()
    assert defaults["contact_email"] == "ccecce035@gmail.com"
    assert defaults["contact_phones"] == ["+221 78 571 82 81", "+221 77 895 15 15"]
    assert defaults["announcement"] is None

    login(client, "admin@example.com")
    new = {
        **defaults,
        "contact_email": "contact@senjapo.sn",
        "contact_phones": ["+221 77 000 00 00", "  "],
        "facebook_url": "https://facebook.com/senjapo",
        "announcement": "Retrouvez-nous à la Foire de Thiès, stand 14",
        "announcement_link": "/stand",
        "hero_subtitle": "",
    }
    r = client.put(URL, json=new)
    assert r.status_code == 200, r.text
    client.cookies.clear()
    saved = client.get(URL).json()
    assert saved["contact_email"] == "contact@senjapo.sn"
    assert saved["contact_phones"] == ["+221 77 000 00 00"]
    assert saved["announcement_link"] == "/stand" and saved["hero_subtitle"] is None
    audit = db_fetch("SELECT action, summary FROM audit_logs WHERE action = 'setting.site_update'")
    assert len(audit) == 1 and "contact_email" in audit[0]["summary"]


def test_invalid_values_are_refused(client, admin):
    base = client.get(URL).json()
    for bad in (
        {"contact_email": "pas-un-email"},
        {"contact_phones": []},
        {"contact_phones": ["abc"]},
        {"facebook_url": "http://facebook.com/x"},
        {"announcement_link": "javascript:alert(1)"},
        {"announcement": "x" * 201},
    ):
        assert client.put(URL, json={**base, **bad}).status_code == 422, bad


def test_only_admins_edit(client):
    base = client.get(URL).json()
    assert client.put(URL, json=base).status_code == 401
    register(client, "president@example.com")
    set_role("president@example.com", "president")
    login(client, "president@example.com")
    assert client.put(URL, json=base).status_code == 403
