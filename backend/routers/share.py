"""Share links with a rich preview (WhatsApp, Facebook, SMS apps).

Link previews are built by robots that read the page without running JavaScript, so the
website (a single-page app) cannot give each campaign its own preview. This route returns a tiny
HTML page carrying the campaign's title, text and photo in Open Graph tags, and sends people on to
the campaign on the website. It is reached through the website's /api relay, on the site's address.
"""

import html
from typing import Optional

from core.config import settings
from core.database import get_db
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from models.projects import Projects
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/share", tags=["share"])


def _absolute(url: Optional[str]) -> str:
    site = settings.frontend_url.rstrip("/")
    if not url:
        return f"{site}/og-image.jpg"
    return url if url.startswith("https://") else f"{site}/{url.lstrip('/')}"


def _summary(text: str, limit: int = 180) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[: limit - 1].rsplit(" ", 1)[0] + "…"


@router.get("/campagne/{project_id}", response_class=HTMLResponse)
async def campaign_preview(project_id: int, db: AsyncSession = Depends(get_db)):
    site = settings.frontend_url.rstrip("/")
    project = await db.get(Projects, project_id)
    if not project or project.status == "paused":
        target, title, description, image = f"{site}/projects", settings.site_short_name, settings.site_name, _absolute(None)
    else:
        target = f"{site}/projects?campagne={project.id}"
        title = project.title
        raised = f"{project.raised:,}".replace(",", " ")
        goal = f"{project.goal:,}".replace(",", " ")
        if project.goal <= 0 or project.status == "completed":
            progress = ""
        elif project.raised > 0:
            progress = f"{raised} FCFA collectés sur {goal} FCFA. "
        else:
            progress = f"Objectif : {goal} FCFA. "  # "0 FCFA collected" would put people off
        description = progress + _summary(project.description)
        image = _absolute(project.image)

    e = html.escape
    share_url = f"{site}/api/v1/share/campagne/{project_id}"
    page = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} · {e(settings.site_short_name)}</title>
<meta name="description" content="{e(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{e(settings.site_short_name)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{e(image)}">
<meta property="og:url" content="{e(share_url)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={e(target)}">
<link rel="canonical" href="{e(target)}">
</head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:40px">
<p><a href="{e(target)}">{e(title)} · voir la campagne sur {e(settings.site_short_name)}</a></p>
</body>
</html>"""
    return HTMLResponse(page, headers={"Cache-Control": "public, max-age=300"})
