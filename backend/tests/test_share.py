"""Share links: a preview page with the campaign's Open Graph tags, sending people to the campaign."""

from tests.conftest import login, make_project


def test_campaign_preview_has_title_photo_and_redirect(client, admin):
    project = make_project(client, title='École "PANISED" <Touba>', description="Construisons ensemble l'école.", image="/collectes/panised-touba.jpg", raised=250_000, goal=120_000_000)
    client.cookies.clear()
    r = client.get(f"/api/v1/share/campagne/{project['id']}")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    page = r.text
    # Escaped title (no HTML injection through a campaign name)
    assert '<meta property="og:title" content="École &quot;PANISED&quot; &lt;Touba&gt;">' in page
    assert 'content="http://localhost:3000/collectes/panised-touba.jpg"' in page
    assert "250 000 FCFA collectés sur 120 000 000 FCFA" in page
    assert f"url=http://localhost:3000/projects?campagne={project['id']}" in page

    login(client, "admin@example.com")
    fresh = make_project(client, raised=0, goal=10_000_000)
    client.cookies.clear()
    assert "Objectif : 10 000 000 FCFA" in client.get(f"/api/v1/share/campagne/{fresh['id']}").text


def test_paused_or_unknown_campaign_falls_back_to_the_site(client, admin):
    paused = make_project(client, status="paused", title="Secret")
    client.cookies.clear()
    for pid in (paused["id"], 999999):
        page = client.get(f"/api/v1/share/campagne/{pid}").text
        assert "Secret" not in page and "url=http://localhost:3000/projects" in page and "og-image.jpg" in page
