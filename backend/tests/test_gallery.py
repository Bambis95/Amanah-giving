"""Campaign gallery: extra photos saved with the campaign, validated, visible to everyone."""

from tests.conftest import make_project

PHOTOS = ["/api/v1/images/" + "a" * 32, "/collectes/femmes-fandene.jpg", "https://exemple.sn/photo.jpg"]


def test_gallery_is_saved_updated_and_cleared(client, admin):
    project = make_project(client, gallery=PHOTOS)
    assert project["gallery"] == PHOTOS

    r = client.put(f"/api/v1/entities/projects/{project['id']}", json={"gallery": PHOTOS[:1]})
    assert r.status_code == 200 and r.json()["gallery"] == PHOTOS[:1]

    # Other edits leave the gallery alone
    r = client.put(f"/api/v1/entities/projects/{project['id']}", json={"title": "Nouveau titre"})
    assert r.json()["gallery"] == PHOTOS[:1]

    r = client.put(f"/api/v1/entities/projects/{project['id']}", json={"gallery": []})
    assert r.json()["gallery"] == []

    client.cookies.clear()
    public = client.get("/api/v1/entities/projects/all").json()["items"][0]
    assert public["gallery"] == []


def test_unsafe_or_too_many_photos_are_refused(client, admin):
    project = make_project(client)
    url = f"/api/v1/entities/projects/{project['id']}"
    for bad in (["javascript:alert(1)"], ["http://non-chiffre.sn/a.jpg"], ["//autre-site.com/a.jpg"], ["/a.jpg"] * 13):
        assert client.put(url, json={"gallery": bad}).status_code == 422, bad
    assert client.get(url).json()["gallery"] is None
