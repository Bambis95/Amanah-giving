"""Email the administrators when something needs them now, e.g. the payment provider refusing every donation.

At most one email per subject and per hour, so an outage does not flood their mailbox.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Dict, List, Set

from core.config import settings
from models.auth import User
from services import email as mail
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

THROTTLE = timedelta(hours=1)
_last_sent: Dict[str, datetime] = {}
_pending: Set[asyncio.Task] = set()


async def admin_emails(db: AsyncSession) -> List[str]:
    """Active administrators (suspended accounts are left out)."""
    rows = await db.execute(select(User.email).where(User.role == "admin", User.suspended_at.is_(None)))
    return [email for (email,) in rows if email]


def build_alert(recipients: List[str], subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = f"[{settings.site_short_name}] {subject}"
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = ", ".join(recipients)
    message.set_content(f"{body}\n\nCe message est envoyé automatiquement aux administrateurs (au plus une fois par heure).")
    return message


async def alert_admins(db: AsyncSession, key: str, subject: str, body: str) -> bool:
    """Send the alert in the background; False when skipped (email off, sent less than an hour ago, no admin)."""
    if not mail.email_enabled():
        logger.warning("Alert not emailed (SMTP not configured): %s", subject)
        return False
    now = datetime.now(timezone.utc)
    last = _last_sent.get(key)
    if last and now - last < THROTTLE:
        return False
    try:
        recipients = await admin_emails(db)
    except Exception:
        logger.exception("Could not list administrators for alert %s", key)
        return False
    if not recipients:
        return False
    _last_sent[key] = now
    message = build_alert(recipients, subject, body)
    task = asyncio.create_task(asyncio.to_thread(mail.deliver, message, f"alert {key}"))
    _pending.add(task)  # keep a reference until it is done
    task.add_done_callback(_pending.discard)
    return True


async def payment_unavailable(db: AsyncSession, provider: str, error: str) -> None:
    """A donor could not reach the payment page: the provider is down, or its keys are wrong."""
    try:
        await alert_admins(
            db,
            f"payment-{provider}",
            f"Paiements {provider} indisponibles",
            f"Un donateur n'a pas pu accéder à la page de paiement {provider}.\n\n"
            f"Erreur : {error[:500]}\n\n"
            "Vérifiez les clés du prestataire dans Render (service senjapo-api → Environment) et son tableau de bord. "
            "Si le problème continue, prévenez les donateurs ou proposez les QR codes Wave / Orange Money.",
        )
    except Exception:
        logger.exception("Payment alert failed")
