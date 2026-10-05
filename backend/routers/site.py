import re
from typing import List, Optional

from core.config import settings
from core.database import get_db
from dependencies.auth import get_admin_actor
from fastapi import APIRouter, Depends
from models.site_setting import SiteSetting
from pydantic import BaseModel, EmailStr, Field, field_validator
from services import audit
from services.audit import Actor
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/site", tags=["site"])


class SiteStatus(BaseModel):
    donations_enabled: bool
    # Share of the donations that pays the platform (announced on the donation page), when there is one
    platform_fee_percent: Optional[str] = None


@router.get("", response_model=SiteStatus)
async def get_site_status(db: AsyncSession = Depends(get_db)):
    """Public site switches read by the website (e.g. donations closed before launch)."""
    from services import commission

    rate = commission.public_rate(await commission.load(db))
    return SiteStatus(donations_enabled=settings.donations_enabled, platform_fee_percent=rate)


# ---------- editable settings (contacts, social links, home texts) ----------

PHONE = re.compile(r"^\+?[\d\s.-]{8,20}$")


def _https_or_empty(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip() or None
    if value and (len(value) > 300 or not value.startswith("https://")):
        raise ValueError("Le lien doit commencer par https://")
    return value


class SiteSettings(BaseModel):
    """Everything the public site shows that the team may change without a developer.

    Defaults are the values the site was built with, so nothing changes until an admin edits them.
    """

    contact_email: EmailStr = "ccecce035@gmail.com"
    contact_phones: List[str] = Field(default_factory=lambda: ["+221 78 571 82 81", "+221 77 895 15 15"], max_length=4)
    whatsapp_number: Optional[str] = "+221 78 571 82 81"
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None
    # Empty = the site shows its built-in text
    hero_subtitle: Optional[str] = Field(
        default=(
            "Soutenez des projets concrets : jeunes et formation, Daaras, artisans, agriculteurs, femmes et "
            "groupements, personnes vulnérables et projets communautaires."
        ),
        max_length=300,
    )
    # Membership fee paid online on the "Adhérer" page; empty = online payment not offered
    membership_fee: Optional[int] = Field(default=None, ge=500, le=1_000_000)
    membership_fee_label: Optional[str] = Field(default="Cotisation annuelle", max_length=60)
    # Optional banner at the top of the home page (an event, the opening of donations…)
    announcement: Optional[str] = Field(default=None, max_length=200)
    announcement_link: Optional[str] = None

    @field_validator("contact_phones")
    @classmethod
    def _phones(cls, value: List[str]) -> List[str]:
        phones = [p.strip() for p in value if p and p.strip()]
        if not phones:
            raise ValueError("Au moins un numéro de téléphone")
        for phone in phones:
            if not PHONE.match(phone):
                raise ValueError(f"Numéro invalide : {phone}")
        return phones

    @field_validator("whatsapp_number")
    @classmethod
    def _whatsapp(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip() or None
        if value and not PHONE.match(value):
            raise ValueError("Numéro WhatsApp invalide")
        return value

    @field_validator("facebook_url", "instagram_url", "tiktok_url", "youtube_url")
    @classmethod
    def _links(cls, value: Optional[str]) -> Optional[str]:
        return _https_or_empty(value)

    @field_validator("announcement_link")
    @classmethod
    def _announcement_link(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip() or None
        # A page of the site (/projects) or an https:// address
        if value and (len(value) > 300 or not (value.startswith("https://") or (value.startswith("/") and not value.startswith("//")))):
            raise ValueError("Le lien du bandeau doit être une page du site (/…) ou commencer par https://")
        return value

    @field_validator("announcement", "hero_subtitle", "membership_fee_label")
    @classmethod
    def _trim(cls, value: Optional[str]) -> Optional[str]:
        return (value or "").strip() or None


async def load_site_settings(db: AsyncSession) -> SiteSettings:
    stored = {row.key: row.value for row in (await db.execute(select(SiteSetting))).scalars()}
    known = {k: v for k, v in stored.items() if k in SiteSettings.model_fields}
    return SiteSettings(**{**SiteSettings().model_dump(), **known})


@router.get("/settings", response_model=SiteSettings)
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Public: contacts, social links and home texts shown on the site."""
    return await load_site_settings(db)


@router.put("/settings", response_model=SiteSettings)
async def save_settings(data: SiteSettings, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)):
    """Admins: replace the editable settings (the form always sends every field)."""
    before = (await load_site_settings(db)).model_dump()
    after = data.model_dump()
    changed = {k: {"avant": before[k], "apres": after[k]} for k in after if before[k] != after[k]}
    for key, value in after.items():
        row = await db.get(SiteSetting, key)
        if row:
            row.value, row.updated_by = value, actor.id
        else:
            db.add(SiteSetting(key=key, value=value, updated_by=actor.id))
    await db.commit()
    if changed:
        await audit.record(
            db, actor, "setting.site_update", f"Réglages du site modifiés ({', '.join(changed)})",
            target_type="site", details=changed,
        )
    return data
