"""Tontine emails: a receipt to the member at each payment recorded, and the alert to the officers
when the treasurer keeps the money too long without depositing it.

A receipt is the members' protection: a payment the treasurer "forgets" to record shows at once.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Dict, List, Optional

from core.config import settings
from models.site_setting import SiteSetting
from models.tontine import TontineGroup, TontineMember, TontineOperation
from services import email as mail
from services import tontine as ledger_service
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

ALERTS_KEY = "tontine_alerts_sent"
REMIND_EVERY = timedelta(days=3)


def _fcfa(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " F"


def _message(recipient: str, subject: str, text: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = f"[{settings.site_short_name}] {subject}"
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = recipient
    message.set_content(text)
    return message


def build_receipt(member: TontineMember, group: TontineGroup, operations: List[TontineOperation],
                  month_total: int, recorded_by: Optional[str]) -> EmailMessage:
    """One email for what was just recorded for this member (a day's payment, an aid, a payout)."""
    lines = []
    for o in operations:
        what = {"contribution": "Cotisation", "payout": "Versement reçu"}.get(o.kind, o.kind)
        if o.kind == "payout" and o.category:
            what = f"Aide « {ledger_service.AID_CATEGORIES.get(o.category, o.category)} »"
        lines.append(f"- {what} du {o.op_date:%d/%m/%Y} : {_fcfa(o.amount)} ({ledger_service.METHODS.get(o.method, o.method)})")
    text = "\n".join([
        f"Bonjour {member.name},",
        "",
        f"Votre association « {group.name} » vient d'enregistrer :",
        *lines,
        "",
        f"Vos cotisations ce mois-ci : {_fcfa(month_total)}.",
        f"Enregistré par : {recorded_by or 'le trésorier'}.",
        "",
        "Une erreur ? Signalez-la tout de suite à votre trésorier ou à votre président : chaque correction reste inscrite.",
        f"Votre compte complet : {settings.frontend_url.rstrip('/')}/tontines/{group.id}",
        "",
        f"{settings.site_short_name} tient le cahier de votre association. L'argent reste chez votre trésorier et sur le compte de l'association.",
    ])
    return _message(member.email, f"Reçu – {group.name}", text)


async def notify_dormant_cash(db: AsyncSession, today: date) -> int:
    """Email the president and the treasurer of each group whose cash sleeps too long (every 3 days at most)."""
    if not mail.email_enabled():
        return 0
    row = await db.get(SiteSetting, ALERTS_KEY)
    sent: Dict[str, str] = dict(row.value) if row and isinstance(row.value, dict) else {}
    now = datetime.now(timezone.utc)
    count = 0
    # Premium groups only (the alert by email is part of Premium; every group sees it on screen)
    groups = (await db.execute(select(TontineGroup).where(
        TontineGroup.archived_at.is_(None), TontineGroup.suspended_at.is_(None), TontineGroup.premium_until >= today,
    ))).scalars().all()
    for group in groups:
        members = list((await db.execute(select(TontineMember).where(TontineMember.group_id == group.id))).scalars())
        operations = list((await db.execute(select(TontineOperation).where(TontineOperation.group_id == group.id))).scalars())
        book = ledger_service.Ledger(group, members, operations)
        alert = next((a for a in book.alerts(today, today.strftime("%Y-%m")) if a["code"] == "cash_dormant"), None)
        last = sent.get(str(group.id))
        if not alert or (last and now - datetime.fromisoformat(last) < REMIND_EVERY):
            continue
        officers = [m for m in members if m.role in ("president", "treasurer") and m.email and m.left_at is None]
        for officer in officers:
            text = "\n".join([
                f"Bonjour {officer.name},",
                "",
                alert["text"],
                "",
                "Pour la sécurité de tous, déposez cet argent sur le compte bancaire de l'association, puis enregistrez le dépôt",
                "avec la photo du bordereau. Une autre personne le validera.",
                "",
                f"{settings.frontend_url.rstrip('/')}/tontines/{group.id}",
            ])
            await asyncio.to_thread(mail.deliver, _message(officer.email, f"Argent à déposer – {group.name}", text), "tontine alert")
        if officers:
            sent[str(group.id)] = now.isoformat()
            count += 1
    if count:
        if row:
            row.value = sent
        else:
            db.add(SiteSetting(key=ALERTS_KEY, value=sent))
        await db.commit()
    return count
