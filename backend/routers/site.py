from core.config import settings
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/site", tags=["site"])


class SiteStatus(BaseModel):
    donations_enabled: bool


@router.get("", response_model=SiteStatus)
async def get_site_status():
    """Public site switches read by the website (e.g. donations closed before launch)."""
    return SiteStatus(donations_enabled=settings.donations_enabled)
