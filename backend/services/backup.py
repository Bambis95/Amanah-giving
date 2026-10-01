"""Automatic backup: every BACKUP_EMAIL_DAYS days, the data (CSV files, no photos) is emailed to the administrators.

Complements the "Télécharger toutes les données" button. The last sending date is kept in site_settings,
so a restart of the server neither skips nor repeats a backup.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.config import settings
from models.site_setting import SiteSetting
from services import audit
from services import email as mail
from services.alerts import admin_emails, build_alert
from services.audit import Actor
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

LAST_SENT_KEY = "backup_last_sent"
# Mail servers refuse large attachments (Gmail: 25 MB)
MAX_ATTACHMENT = 20 * 1024 * 1024
CHECK_EVERY_SECONDS = 3600
FIRST_CHECK_AFTER_SECONDS = 600


async def _last_sent(db: AsyncSession) -> Optional[datetime]:
    row = await db.get(SiteSetting, LAST_SENT_KEY)
    try:
        return datetime.fromisoformat(row.value) if row and row.value else None
    except (TypeError, ValueError):
        return None


async def send_backup_if_due(db: AsyncSession, now: Optional[datetime] = None) -> bool:
    """Email the backup when the interval has passed; True when it was sent."""
    from routers.export import build_archive  # the router module holds the table list

    days = settings.backup_email_days
    if days <= 0 or not mail.email_enabled():
        return False
    now = now or datetime.now(timezone.utc)
    last = await _last_sent(db)
    if last and now - last < timedelta(days=days):
        return False
    recipients = await admin_emails(db)
    if not recipients:
        return False

    content, counts = await build_archive(db, with_files=False)
    stamp = now.strftime("%Y-%m-%d")
    if len(content) > MAX_ATTACHMENT:
        logger.warning("Backup too large to email (%s bytes): use the export button", len(content))
        return False
    message = build_alert(
        recipients,
        f"Sauvegarde automatique du {now.strftime('%d/%m/%Y')}",
        "Vous trouverez en pièce jointe la sauvegarde des données de la plateforme (fichiers CSV, lisibles dans Excel) : "
        "campagnes, dons, comptes, finances, abonnés, messages et journal.\n\n"
        "Elle contient des données personnelles : conservez-la en lieu sûr et ne la transférez pas. Les photos et "
        "justificatifs ne sont pas inclus : téléchargez l'export complet depuis Réglages du site.",
    )
    message.add_attachment(content, maintype="application", subtype="zip", filename=f"senjapo-sauvegarde-{stamp}.zip")
    if not await asyncio.to_thread(mail.deliver, message, "weekly backup"):
        return False

    row = await db.get(SiteSetting, LAST_SENT_KEY)
    if row:
        row.value = now.isoformat()
    else:
        db.add(SiteSetting(key=LAST_SENT_KEY, value=now.isoformat()))
    await db.commit()
    await audit.record(
        db, Actor(email="système"), "security.backup_email",
        f"Sauvegarde automatique envoyée à {len(recipients)} administrateur(s)",
        target_type="export", details=counts,
    )
    return True


async def backup_loop() -> None:
    """Runs for the life of the server: checks every hour whether a backup is due."""
    from core.database import db_manager

    await asyncio.sleep(FIRST_CHECK_AFTER_SECONDS)
    while True:
        try:
            if db_manager.async_session_maker:
                async with db_manager.async_session_maker() as db:
                    await send_backup_if_due(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Automatic backup failed")
        await asyncio.sleep(CHECK_EVERY_SECONDS)
