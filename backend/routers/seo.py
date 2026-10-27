"""robots.txt and sitemap.xml of the website, built from FRONTEND_URL (so they follow the future domain).

The website relays /robots.txt and /sitemap.xml here (render.yaml). The sitemap lists the public pages
and every campaign shown on the site (paused ones excluded); private pages are kept out of search engines.
"""

from datetime import datetime, timezone
from xml.sax.saxutils import escape

from core.config import settings
from core.database import get_db
from fastapi import APIRouter, Depends, Response
from models.projects import Projects
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/seo", tags=["seo"])

# (address, how often it changes, priority)
PUBLIC_PAGES = [
    ("/", "daily", "1.0"),
    ("/projects", "daily", "0.9"),
    ("/donate", "weekly", "0.9"),
    ("/tontines", "weekly", "0.8"),
    ("/transparence", "weekly", "0.7"),
    ("/about", "monthly", "0.6"),
    ("/adherer", "monthly", "0.6"),
    ("/proposer", "monthly", "0.6"),
    ("/partenaires", "monthly", "0.5"),
    ("/contact", "monthly", "0.5"),
    ("/confidentialite", "yearly", "0.2"),
    ("/conditions", "yearly", "0.2"),
]

# Accounts, dashboard, payment returns, print material: nothing to find there
PRIVATE_PATHS = ["/admin", "/mon-espace", "/login", "/forgot-password", "/reset-password", "/invitation",
                 "/desabonnement", "/payment/", "/tontines/", "/affiche", "/stand", "/adherer/imprimer", "/api/"]


def _site() -> str:
    return settings.frontend_url.rstrip("/")


@router.get("/robots.txt")
async def robots():
    lines = ["User-agent: *", "Allow: /", "Allow: /api/v1/share/"]
    lines += [f"Disallow: {path}" for path in PRIVATE_PATHS]
    lines += ["", f"Sitemap: {_site()}/sitemap.xml", ""]
    return Response("\n".join(lines), media_type="text/plain", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/sitemap.xml")
async def sitemap(db: AsyncSession = Depends(get_db)):
    site = _site()
    today = datetime.now(timezone.utc).date().isoformat()
    urls = [(f"{site}{path}", today, freq, prio) for path, freq, prio in PUBLIC_PAGES]
    campaigns = (await db.execute(
        select(Projects.id, Projects.created_at).where(or_(Projects.status.is_(None), Projects.status != "paused")).order_by(Projects.id)
    )).all()
    for project_id, created in campaigns:
        lastmod = (created or datetime.now(timezone.utc)).date().isoformat()
        urls.append((f"{site}/projects?campagne={project_id}", lastmod, "weekly", "0.8"))
    body = "\n".join(
        f"  <url><loc>{escape(loc)}</loc><lastmod>{lastmod}</lastmod><changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        for loc, lastmod, freq, prio in urls
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'
    return Response(xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})
