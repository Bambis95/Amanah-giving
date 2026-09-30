"""Campaign news: written by managers, read by everyone, hidden with a paused campaign."""

from tests.conftest import db_fetch, login, make_project, register, set_role


def post(client, project_id, **overrides):
    data = {"title": "Les fondations sont posées", "body": "Les maçons ont terminé les fondations du bâtiment A.", "image": "/api/v1/images/" + "b" * 32}
    data.update(overrides)
    return client.post(f"/api/v1/updates/project/{project_id}", json=data)


def test_news_is_published_edited_and_deleted(client, admin):
    project = make_project(client, title="École PANISED")
    first = post(client, project["id"]).json()
    second = post(client, project["id"], title="Tables livrées", image=None).json()
    assert first["project_title"] == "École PANISED"

    client.cookies.clear()
    public = client.get("/api/v1/updates").json()
    assert [u["title"] for u in public] == ["Tables livrées", "Les fondations sont posées"]
    assert len(client.get("/api/v1/updates", params={"project_id": project["id"], "limit": 1}).json()) == 1

    login(client, "admin@example.com")
    r = client.put(f"/api/v1/updates/{second['id']}", json={"title": "40 tables livrées", "body": "Livraison à Touba."})
    assert r.status_code == 200 and r.json()["title"] == "40 tables livrées"
    assert client.delete(f"/api/v1/updates/{first['id']}").status_code == 200
    assert [u["title"] for u in client.get("/api/v1/updates").json()] == ["40 tables livrées"]
    actions = [row["action"] for row in db_fetch("SELECT action FROM audit_logs WHERE action LIKE 'project.news%' ORDER BY id")]
    assert actions == ["project.news_create", "project.news_create", "project.news_update", "project.news_delete"]


def test_paused_campaign_news_is_hidden_from_the_public(client, admin):
    project = make_project(client, status="paused")
    post(client, project["id"])
    assert len(client.get("/api/v1/updates/manage", params={"project_id": project["id"]}).json()) == 1
    client.cookies.clear()
    assert client.get("/api/v1/updates").json() == []


def test_validation_and_rights(client, admin):
    project = make_project(client)
    assert post(client, project["id"], title="").status_code == 422
    assert post(client, project["id"], image="javascript:alert(1)").status_code == 422
    assert post(client, 999999).status_code == 404

    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")
    assert post(client, project["id"]).status_code == 403
    client.cookies.clear()
    assert post(client, project["id"]).status_code == 401
