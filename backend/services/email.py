import html
import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

from core.config import settings
from models.auth import User
from models.donations import Donations
from models.projects import Projects
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Same categories as the website (frontend/src/lib/categories.ts)
CAUSE_LABELS = {
    "youth": "Jeunes & formation",
    "education": "Daaras & éducation",
    "entrepreneurship": "Artisans & entrepreneurs",
    "agriculture": "Agriculteurs & élevage",
    "women": "Femmes & groupements",
    "vulnerable": "Personnes vulnérables",
    "community": "Projets communautaires à impact",
    # no longer offered, kept for older donations
    "sanitation": "Assainissement & cadre de vie",
    "health": "Santé",
    "water": "Eau potable",
    "other": "Autres projets",
    "food": "Alimentation",
    "housing": "Logement",
    "general": "Don général",
}

METHOD_LABELS = {
    "stripe": "Carte bancaire",
    "card": "Carte bancaire",
    "wave": "Wave",
    "orange_money": "Orange Money",
}


def email_enabled() -> bool:
    return bool(settings.smtp_host and settings.email_from)


def _format_cfa(amount: int) -> str:
    # French thousands separator; a plain no-break space renders in every mail client
    return f"{amount:,}".replace(",", " ") + " FCFA"


def build_donation_confirmation(
    donation: Donations, recipient: str, project_title: Optional[str]
) -> EmailMessage:
    donor_name = " ".join(filter(None, [donation.donor_first_name, donation.donor_last_name])).strip()
    greeting = f"Bonjour {donor_name}," if donor_name else "Bonjour,"
    amount = _format_cfa(donation.amount)
    destination = project_title or CAUSE_LABELS.get(donation.cause, donation.cause)
    method = METHOD_LABELS.get(donation.payment_method, donation.payment_method)
    date = (donation.created_at or datetime.now(timezone.utc)).strftime("%d/%m/%Y")
    reference = f"{settings.site_short_name}-{donation.id:06d}"

    details = [
        ("Montant", amount),
        ("Destination", destination),
        ("Moyen de paiement", method),
        ("Date", date),
        ("Référence", reference),
    ]

    text = "\n".join(
        [
            greeting,
            "",
            f"Merci pour votre don de {amount} sur {settings.site_short_name}. Votre paiement a bien été reçu.",
            "",
            *[f"{label} : {value}" for label, value in details],
            "",
            "Conservez cet email comme justificatif de votre don.",
            "Pour toute question, répondez simplement à ce message.",
            "",
            "Avec toute notre gratitude,",
            f"L'équipe {settings.site_short_name}",
        ]
    )

    rows = "".join(
        f'<tr><td style="padding:6px 0;color:#6B7280">{html.escape(label)}</td>'
        f'<td style="padding:6px 0;text-align:right;font-weight:600;color:#1A1A2E">{html.escape(value)}</td></tr>'
        for label, value in details
    )
    body_html = f"""\
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;color:#374151">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#044990;padding:24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">{html.escape(settings.site_short_name)}</div>
      <div style="font-size:14px;opacity:.85">Merci pour votre générosité</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px">{html.escape(greeting)}</p>
      <p style="margin:0 0 20px">Merci pour votre don de <strong>{html.escape(amount)}</strong>.
        Votre paiement a bien été reçu.</p>
      <table role="presentation" width="100%" style="border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;margin-bottom:20px">{rows}</table>
      <p style="margin:0 0 8px;font-size:13px;color:#6B7280">Conservez cet email comme justificatif de votre don.
        Pour toute question, répondez simplement à ce message.</p>
      <p style="margin:20px 0 0">Avec toute notre gratitude,<br>L'équipe {html.escape(settings.site_short_name)}</p>
    </td></tr>
  </table>
</body>
</html>"""

    message = EmailMessage()
    message["Subject"] = f"Merci pour votre don de {amount}"
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(body_html, subtype="html")
    return message


def _send(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    if settings.smtp_use_ssl:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=20)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
    with server:
        if not settings.smtp_use_ssl:
            server.starttls(context=context)
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


async def _resolve_recipient(db: AsyncSession, donation: Donations) -> Optional[str]:
    if donation.donor_email:
        return donation.donor_email
    if donation.user_id:
        user = (await db.execute(select(User).where(User.id == donation.user_id))).scalar_one_or_none()
        return user.email if user else None
    return None


async def prepare_donation_confirmation(db: AsyncSession, donation: Donations) -> Optional[EmailMessage]:
    """Build the confirmation email while the DB session is open; None when it cannot or should not be sent."""
    if not email_enabled():
        logger.info("SMTP not configured, skipping confirmation email for donation %s", donation.id)
        return None
    try:
        recipient = await _resolve_recipient(db, donation)
        if not recipient:
            logger.warning("No email address for donation %s, confirmation not sent", donation.id)
            return None
        project_title = None
        if donation.project_id:
            project = (
                await db.execute(select(Projects).where(Projects.id == donation.project_id))
            ).scalar_one_or_none()
            project_title = project.title if project else None
        return build_donation_confirmation(donation, recipient, project_title)
    except Exception:
        logger.exception("Failed to prepare confirmation email for donation %s", donation.id)
        return None


def send_email(message: EmailMessage, context: str) -> None:
    """Blocking send, meant to run as a FastAPI background task. Never raises: a mail failure must not break the request."""
    try:
        _send(message)
        logger.info("Email sent (%s)", context)
    except Exception:
        logger.exception("Failed to send email (%s)", context)


def deliver(message: EmailMessage, context: str) -> bool:
    """Blocking send that reports the outcome, for when the request depends on it (login code)."""
    try:
        _send(message)
        logger.info("Email sent (%s)", context)
        return True
    except Exception:
        logger.exception("Failed to send email (%s)", context)
        return False


def build_login_code_email(recipient: str, name: Optional[str], code: str, valid_minutes: int) -> EmailMessage:
    site = settings.site_short_name
    greeting = f"Bonjour {name}," if name else "Bonjour,"
    spaced = f"{code[:3]} {code[3:]}"
    text = "\n".join(
        [
            greeting,
            "",
            f"Voici votre code de connexion au tableau de bord {site} : {spaced}",
            f"Il est valable {valid_minutes} minutes.",
            "",
            "Si vous n'essayez pas de vous connecter, changez votre mot de passe : quelqu'un le connaît.",
            "",
            f"L'équipe {site}",
        ]
    )
    body_html = f"""\
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;color:#374151">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#044990;padding:24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">{html.escape(site)}</div>
      <div style="font-size:14px;opacity:.85">Code de connexion</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px">{html.escape(greeting)}</p>
      <p style="margin:0 0 16px">Voici votre code de connexion au tableau de bord :</p>
      <p style="margin:0 0 16px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1A1A2E">{html.escape(spaced)}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#6B7280">Il est valable {valid_minutes} minutes. Ne le communiquez à personne :
        l'équipe {html.escape(site)} ne vous le demandera jamais.</p>
      <p style="margin:0;font-size:13px;color:#6B7280">Si vous n'essayez pas de vous connecter, changez votre mot de passe :
        quelqu'un le connaît.</p>
    </td></tr>
  </table>
</body>
</html>"""
    message = EmailMessage()
    message["Subject"] = f"{spaced} : votre code de connexion {site}"
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(body_html, subtype="html")
    return message


def build_invitation_email(
    recipient: str,
    name: Optional[str],
    role_label: str,
    inviter: Optional[str],
    invite_url: str,
    valid_hours: int,
) -> EmailMessage:
    site = settings.site_short_name
    greeting = f"Bonjour {name}," if name else "Bonjour,"
    by = f"{inviter} vous invite" if inviter else "Vous êtes invité(e)"
    text = "\n".join(
        [
            greeting,
            "",
            f"{by} à rejoindre l'équipe {site} en tant que {role_label}.",
            f"Ouvrez ce lien pour choisir votre mot de passe et activer votre accès (valable {valid_hours} heures) :",
            "",
            invite_url,
            "",
            "Si vous ne vous attendiez pas à cette invitation, ignorez simplement cet email.",
            "",
            f"L'équipe {site}",
        ]
    )
    body_html = f"""\
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;color:#374151">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#044990;padding:24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">{html.escape(site)}</div>
      <div style="font-size:14px;opacity:.85">Invitation à rejoindre l'équipe</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px">{html.escape(greeting)}</p>
      <p style="margin:0 0 20px">{html.escape(by)} à rejoindre l'équipe {html.escape(site)}
        en tant que <strong>{html.escape(role_label)}</strong>.
        Choisissez votre mot de passe pour activer votre accès au tableau de bord.</p>
      <p style="margin:0 0 20px;text-align:center">
        <a href="{html.escape(invite_url)}" style="display:inline-block;background:#F57206;color:#1A1A2E;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px">Activer mon accès</a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#6B7280">Ce lien est valable {valid_hours} heures et ne sert qu'une fois.
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
        <span style="word-break:break-all">{html.escape(invite_url)}</span></p>
      <p style="margin:16px 0 0;font-size:13px;color:#6B7280">Si vous ne vous attendiez pas à cette invitation,
        ignorez simplement cet email.</p>
    </td></tr>
  </table>
</body>
</html>"""
    message = EmailMessage()
    message["Subject"] = f"Invitation à rejoindre l'équipe {site}"
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(body_html, subtype="html")
    return message


def build_password_reset_email(recipient: str, name: Optional[str], reset_url: str, valid_minutes: int) -> EmailMessage:
    greeting = f"Bonjour {name}," if name else "Bonjour,"
    text = "\n".join(
        [
            greeting,
            "",
            f"Vous avez demandé à réinitialiser le mot de passe de votre compte {settings.site_short_name}.",
            f"Ouvrez ce lien pour choisir un nouveau mot de passe (valable {valid_minutes} minutes) :",
            "",
            reset_url,
            "",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
            "",
            f"L'équipe {settings.site_short_name}",
        ]
    )
    body_html = f"""\
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;color:#374151">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#044990;padding:24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">{html.escape(settings.site_short_name)}</div>
      <div style="font-size:14px;opacity:.85">Réinitialisation du mot de passe</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px">{html.escape(greeting)}</p>
      <p style="margin:0 0 20px">Vous avez demandé à réinitialiser le mot de passe de votre compte.
        Ce lien est valable {valid_minutes} minutes et ne peut servir qu'une fois.</p>
      <p style="margin:0 0 20px;text-align:center">
        <a href="{html.escape(reset_url)}" style="display:inline-block;background:#044990;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px">Choisir un nouveau mot de passe</a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#6B7280">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
        <span style="word-break:break-all">{html.escape(reset_url)}</span></p>
      <p style="margin:16px 0 0;font-size:13px;color:#6B7280">Si vous n'êtes pas à l'origine de cette demande,
        ignorez cet email : votre mot de passe reste inchangé.</p>
    </td></tr>
  </table>
</body>
</html>"""
    message = EmailMessage()
    message["Subject"] = f"Réinitialisation de votre mot de passe {settings.site_short_name}"
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(body_html, subtype="html")
    return message
