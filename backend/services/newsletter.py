"""Newsletter: consent-based subscriptions and the email sent to subscribers."""

import html
import logging
import re
import secrets
import time
from email.message import EmailMessage
from email.utils import formataddr
from typing import Iterable, Optional

from core.config import settings
from models.newsletter import Subscriber
from services import email as mail
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Gmail accepts a few hundred messages a day: stay well under, with a pause between messages
PAUSE_SECONDS = 0.5
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def subscribe(db: AsyncSession, email: str, name: Optional[str], source: str) -> None:
    """Record an explicit consent; a returning person who had unsubscribed is subscribed again."""
    address = email.strip().lower()
    if not EMAIL.match(address):
        return
    row = (await db.execute(select(Subscriber).where(Subscriber.email == address))).scalar_one_or_none()
    if row:
        if row.unsubscribed_at is not None:
            row.unsubscribed_at = None
            row.source = source
        if name and not row.name:
            row.name = name.strip()[:255]
    else:
        db.add(Subscriber(email=address, name=(name or "").strip()[:255] or None, source=source, token=secrets.token_urlsafe(32)))
    await db.commit()


def unsubscribe_url(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/desabonnement?token={token}"


def build_newsletter(recipient: str, name: Optional[str], subject: str, body: str, cta: Optional[tuple[str, str]], token: str) -> EmailMessage:
    """One subscriber's copy: greeting, the text, an optional button, and the unsubscribe link."""
    site = settings.site_short_name
    greeting = f"Bonjour {name}," if name else "Bonjour,"
    leave = unsubscribe_url(token)
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    text = "\n".join(
        [greeting, "", body.strip(), ""]
        + ([f"{cta[0]} : {cta[1]}", ""] if cta else [])
        + [f"L'équipe {site}", "", f"Ne plus recevoir ces nouvelles : {leave}"]
    )
    body_html = "".join(
        f'<p style="margin:0 0 14px;line-height:1.55">{html.escape(p).replace(chr(10), "<br>")}</p>' for p in paragraphs
    )
    button = (
        f'<p style="margin:20px 0;text-align:center"><a href="{html.escape(cta[1])}" '
        f'style="display:inline-block;background:#F57206;color:#1A1A2E;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px">{html.escape(cta[0])}</a></p>'
        if cta else ""
    )
    page = f"""\
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;color:#374151">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#044990;padding:24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">{html.escape(site)}</div>
      <div style="font-size:14px;opacity:.85">{html.escape(subject)}</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 14px">{html.escape(greeting)}</p>
      {body_html}
      {button}
      <p style="margin:20px 0 0">L'équipe {html.escape(site)}</p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#F9FAFB;font-size:12px;color:#6B7280">
      Vous recevez cet email car vous avez demandé à être tenu(e) informé(e) des actions de {html.escape(site)}.
      <a href="{html.escape(leave)}" style="color:#6B7280">Se désabonner</a>
    </td></tr>
  </table>
</body>
</html>"""
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = recipient
    # Lets mail apps show their own "unsubscribe" button
    message["List-Unsubscribe"] = f"<{leave}>"
    message.set_content(text)
    message.add_alternative(page, subtype="html")
    return message


def send_all(messages: Iterable[EmailMessage], context: str) -> None:
    """Background task: send one by one, pausing between messages; a failure never stops the others."""
    sent = failed = 0
    for message in messages:
        if mail.deliver(message, context):
            sent += 1
        else:
            failed += 1
        time.sleep(PAUSE_SECONDS)
    logger.info("Newsletter %s: %s sent, %s failed", context, sent, failed)
