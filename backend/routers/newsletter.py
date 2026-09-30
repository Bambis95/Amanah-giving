"""Newsletter to subscribers who asked for SENJAPO news (presidents and admins send it)."""

from datetime import datetime, timezone
from typing import List, Optional

from core.config import settings
from core.database import get_db
from dependencies.auth import get_manager_actor
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from models.auth import User
from models.newsletter import NewsletterIssue, Subscriber
from models.projects import Projects
from pydantic import BaseModel, Field
from services import audit
from services import email as mail
from services import newsletter
from services.audit import Actor
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/newsletter", tags=["newsletter"])

# One send stays under Gmail's daily limit; beyond it, move to a mailing service
MAX_RECIPIENTS = 400


class IssueIn(BaseModel):
    subject: str = Field(min_length=3, max_length=150)
    body: str = Field(min_length=10, max_length=5000)
    project_id: Optional[int] = None


def _active():
    return Subscriber.unsubscribed_at.is_(None)


async def _cta(db: AsyncSession, project_id: Optional[int]) -> Optional[tuple[str, str]]:
    if project_id is None:
        return None
    project = await db.get(Projects, project_id)
    if not project or project.status == "paused":
        raise HTTPException(status_code=400, detail="Campagne introuvable ou masquée")
    return ("Voir la campagne", f"{settings.frontend_url.rstrip('/')}/projects?campagne={project.id}")


def _require_mail() -> None:
    if not mail.email_enabled():
        raise HTTPException(status_code=503, detail="L'envoi d'emails n'est pas configuré sur le serveur (réglages SMTP).")


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db), _actor: Actor = Depends(get_manager_actor)):
    """Subscriber counts and the sent history (no email addresses listed)."""
    active = (await db.execute(select(func.count(Subscriber.id)).where(_active()))).scalar_one()
    left = (await db.execute(select(func.count(Subscriber.id)).where(Subscriber.unsubscribed_at.is_not(None)))).scalar_one()
    by_source = dict((await db.execute(select(Subscriber.source, func.count(Subscriber.id)).where(_active()).group_by(Subscriber.source))).all())
    issues = (await db.execute(
        select(NewsletterIssue, User.name, User.email).outerjoin(User, User.id == NewsletterIssue.sent_by)
        .order_by(NewsletterIssue.sent_at.desc()).limit(20)
    )).all()
    return {
        "active": active,
        "unsubscribed": left,
        "by_source": by_source,
        "max_recipients": MAX_RECIPIENTS,
        "email_enabled": mail.email_enabled(),
        "issues": [
            {"id": i.id, "subject": i.subject, "recipients": i.recipients, "sent_at": i.sent_at, "sent_by": name or email}
            for i, name, email in issues
        ],
    }


@router.post("/test")
async def send_test(data: IssueIn, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_manager_actor)):
    """Send the draft to oneself only, to check it before the real sending."""
    _require_mail()
    me = await db.get(User, actor.id)
    message = newsletter.build_newsletter(me.email, me.name, f"[Test] {data.subject}", data.body, await _cta(db, data.project_id), "test")
    background_tasks.add_task(mail.send_email, message, "newsletter test")
    return {"message": f"Test envoyé à {me.email}"}


@router.post("/send")
async def send(data: IssueIn, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_manager_actor)):
    """Send to every active subscriber (in the background), and keep it in the history."""
    _require_mail()
    cta = await _cta(db, data.project_id)
    subscribers = list((await db.execute(select(Subscriber).where(_active()).order_by(Subscriber.id).limit(MAX_RECIPIENTS + 1))).scalars())
    if not subscribers:
        raise HTTPException(status_code=400, detail="Aucun abonné pour le moment.")
    if len(subscribers) > MAX_RECIPIENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Plus de {MAX_RECIPIENTS} abonnés : il faut passer à un service d'envoi d'emails (Brevo, Mailjet…).",
        )
    messages = [newsletter.build_newsletter(s.email, s.name, data.subject, data.body, cta, s.token) for s in subscribers]
    issue = NewsletterIssue(subject=data.subject, body=data.body, project_id=data.project_id, recipients=len(messages), sent_by=actor.id)
    db.add(issue)
    await db.commit()
    background_tasks.add_task(newsletter.send_all, messages, f"issue {issue.id}")
    await audit.record(
        db, actor, "message.newsletter_send", f"Newsletter « {data.subject} » envoyée à {len(messages)} abonné(s)",
        target_type="newsletter", target_id=issue.id,
    )
    return {"message": f"Envoi en cours à {len(messages)} abonné(s).", "recipients": len(messages)}


class UnsubscribeIn(BaseModel):
    token: str = Field(min_length=10, max_length=64)


@router.post("/unsubscribe")
async def unsubscribe(data: UnsubscribeIn, db: AsyncSession = Depends(get_db)):
    """Public: the one-click link of every newsletter (always answers the same, to reveal nothing)."""
    row = (await db.execute(select(Subscriber).where(Subscriber.token == data.token))).scalar_one_or_none()
    if row and row.unsubscribed_at is None:
        row.unsubscribed_at = datetime.now(timezone.utc)
        await db.commit()
    return {"message": "Vous ne recevrez plus les nouvelles de SENJAPO par email."}
