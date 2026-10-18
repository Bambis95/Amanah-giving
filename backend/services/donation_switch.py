"""Opening and closing online donations from the admin dashboard (Réglages du site).

Until an admin uses the switch, DONATIONS_ENABLED (Render) decides. Once used, the switch decides.
Closing is always possible (emergency); opening is refused while payments cannot really be taken
(provider keys missing, or the provider still in test mode). Every change is sealed in the journal
and emailed to all the admins.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from core.config import settings
from models.site_setting import SiteSetting
from sqlalchemy.ext.asyncio import AsyncSession

KEY = "donations_switch"


def provider_state() -> Dict[str, Any]:
    if settings.payment_provider.lower() == "paytech":
        keys = bool(settings.paytech_api_key and settings.paytech_api_secret)
        return {"provider": "PayTech", "keys": keys, "mode": settings.paytech_env, "live": settings.paytech_env == "prod"}
    keys = bool(settings.paydunya_master_key and settings.paydunya_private_key and settings.paydunya_token)
    return {"provider": "PayDunya", "keys": keys, "mode": settings.paydunya_mode, "live": settings.paydunya_mode == "live"}


def blockers() -> List[str]:
    """Why donations cannot be opened now (empty when they can)."""
    state = provider_state()
    problems = []
    if not state["keys"]:
        problems.append(f"Les clés {state['provider']} ne sont pas renseignées dans Render.")
    if not state["live"]:
        problems.append(
            f"{state['provider']} est en mode « {state['mode']} » : les donateurs ne seraient pas réellement débités. "
            f"Passez en production dans Render après l'activation du compte."
        )
    return problems


async def _row(db: AsyncSession) -> Optional[SiteSetting]:
    return await db.get(SiteSetting, KEY)


async def donations_open(db: AsyncSession) -> bool:
    row = await _row(db)
    if row and isinstance(row.value, dict) and "open" in row.value:
        return bool(row.value["open"])
    return settings.donations_enabled


async def state(db: AsyncSession) -> Dict[str, Any]:
    row = await _row(db)
    value = row.value if row and isinstance(row.value, dict) else None
    return {
        "open": await donations_open(db),
        "source": "admin" if value else "render",
        "changed_by": value.get("by") if value else None,
        "changed_at": value.get("at") if value else None,
        "reason": value.get("reason") if value else None,
        "can_open": not blockers(),
        "blockers": blockers(),
        **provider_state(),
    }


async def set_open(db: AsyncSession, open_: bool, by: Optional[str], user_id: Optional[str], reason: str) -> None:
    value = {"open": open_, "by": by, "at": datetime.now(timezone.utc).isoformat(), "reason": reason or None}
    row = await _row(db)
    if row:
        row.value, row.updated_by = value, user_id
    else:
        db.add(SiteSetting(key=KEY, value=value, updated_by=user_id))
    await db.commit()
