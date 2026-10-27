"""robots.txt and sitemap.xml: public pages and campaigns in, private pages out."""

from tests.conftest import make_project


def test_robots_points_to_the_sitemap_and_hides_private_pages(client):
    r = client.get("/api/v1/seo/robots.txt")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/plain")
    assert "Sitemap: http://localhost:3000/sitemap.xml" in r.text
    for path in ("/admin", "/mon-espace", "/login", "/payment/", "/tontines/"):
        assert f"Disallow: {path}" in r.text


def test_sitemap_lists_pages_and_visible_campaigns(client, admin):
    shown = make_project(client, title="Forage à Thiès")
    paused = make_project(client, title="En pause", status="paused")
    r = client.get("/api/v1/seo/sitemap.xml")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/xml")
    assert "<loc>http://localhost:3000/</loc>" in r.text and "<loc>http://localhost:3000/tontines</loc>" in r.text
    assert f"/projects?campagne={shown['id']}" in r.text
    assert f"/projects?campagne={paused['id']}" not in r.text
    assert "/admin" not in r.text
