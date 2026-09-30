"""Staff invitations: a president or an admin invites someone by email, with the role already chosen.

The invited person opens the emailed link, chooses a password and lands on the dashboard. This
replaces "create an account, then ask to be promoted", where nothing proved that the account
really belonged to the person whose email it carried.
"""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from core.config import settings
from core.database import get_db
from core.session import idle_minutes_for, issue_session
from dependencies.auth import client_ip, get_manager_actor
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from models.auth import User
from models.invitation import Invitation
from pydantic import BaseModel, EmailStr
from routers.auth import check_password_strength
from services import audit
from services.audit import Actor
from services.auth import hash_password
from services.email import build_invitation_email, email_enabled, send_email
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/invitations", tags=["invitations"])
logger = logging.getLogger(__name__)

INVITE_HOURS = 48
ROLE_LABELS = {"member": "membre du club", "treasurer": "trésorier", "president": "président", "admin": "administrateur"}
# What a president may invite (and revoke): members only, as for role changes
PRESIDENT_INVITES = ("member",)
INVALID_LINK = "Cette invitation est invalide, a expiré ou a déjà été utilisée. Demandez-en une nouvelle."


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _pending(now: datetime):
    return (Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None), Invitation.expires_at > now)


def _check_can_invite(actor_role: str, role: str) -> None:
    if actor_role != "admin" and role not in PRESIDENT_INVITES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un administrateur peut inviter un président ou un administrateur.",
        )


async def _actor_role(db: AsyncSession, actor: Actor) -> str:
    user = await db.get(User, actor.id)
    return user.role if user else "user"


class InvitationCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: Literal["member", "treasurer", "president", "admin"]


class InvitationResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    role: str
    expires_at: datetime
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvitationCreated(BaseModel):
    invitation: InvitationResponse
    # Shown once to the person who invites, so it can also be sent by WhatsApp or SMS
    invite_url: str
    email_sent: bool


class InvitationPreview(BaseModel):
    email: str
    name: Optional[str] = None
    role: str
    expires_at: datetime


class AcceptInvitation(BaseModel):
    token: str
    password: str
    name: Optional[str] = None


@router.post("", response_model=InvitationCreated, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    actor: Actor = Depends(get_manager_actor),
):
    """Invite someone to the team. A new invitation replaces any pending one for the same email."""
    inviter = await db.get(User, actor.id)
    _check_can_invite(inviter.role if inviter else "user", payload.role)

    email = payload.email.lower()
    if (await db.execute(select(User.id).where(User.email == email))).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email : changez son rôle dans la liste des comptes.",
        )

    now = datetime.now(timezone.utc)
    await db.execute(update(Invitation).where(Invitation.email == email, *_pending(now)).values(revoked_at=now))
    token = secrets.token_urlsafe(32)
    name = (payload.name or "").strip() or None
    invitation = Invitation(
        email=email,
        name=name,
        role=payload.role,
        token_hash=_hash(token),
        invited_by=actor.id,
        expires_at=now + timedelta(hours=INVITE_HOURS),
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    invite_url = f"{settings.frontend_url.rstrip('/')}/invitation?token={token}"
    email_sent = email_enabled()
    if email_sent:
        message = build_invitation_email(
            email, name, ROLE_LABELS[payload.role], inviter.name if inviter else None, invite_url, INVITE_HOURS
        )
        background_tasks.add_task(send_email, message, f"invitation {invitation.id}")
    else:
        logger.warning("Invitation %s created but SMTP is not configured: share the link by hand", invitation.id)

    await audit.record(
        db, actor, "user.invite",
        f"Invitation envoyée à {email} ({ROLE_LABELS[payload.role]})",
        target_type="invitation", target_id=invitation.id,
        details={"email": email, "role": payload.role},
    )
    return InvitationCreated(invitation=invitation, invite_url=invite_url, email_sent=email_sent)


@router.get("", response_model=List[InvitationResponse])
async def list_invitations(db: AsyncSession = Depends(get_db), _actor: Actor = Depends(get_manager_actor)):
    """Invitations still waiting to be accepted."""
    now = datetime.now(timezone.utc)
    result = await db.execute(select(Invitation).where(*_pending(now)).order_by(Invitation.created_at.desc()))
    return result.scalars().all()


@router.delete("/{invitation_id}")
async def revoke_invitation(
    invitation_id: int, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_manager_actor)
):
    """Cancel a pending invitation: its link stops working."""
    invitation = await db.get(Invitation, invitation_id)
    now = datetime.now(timezone.utc)
    if not invitation or invitation.accepted_at or invitation.revoked_at or invitation.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation introuvable ou déjà terminée.")
    _check_can_invite(await _actor_role(db, actor), invitation.role)
    invitation.revoked_at = now
    await db.commit()
    await audit.record(
        db, actor, "user.invite_revoked", f"Invitation annulée : {invitation.email}",
        target_type="invitation", target_id=invitation.id, details={"email": invitation.email},
    )
    return {"message": "Invitation annulée"}


async def _valid_invitation(db: AsyncSession, token: str) -> Invitation:
    now = datetime.now(timezone.utc)
    invitation = (
        await db.execute(select(Invitation).where(Invitation.token_hash == _hash(token), *_pending(now)))
    ).scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_LINK)
    return invitation


@router.get("/preview", response_model=InvitationPreview)
async def preview_invitation(token: str, db: AsyncSession = Depends(get_db)):
    """Public: what the link offers, so the page can greet the invited person."""
    invitation = await _valid_invitation(db, token)
    return InvitationPreview(
        email=invitation.email, name=invitation.name, role=invitation.role, expires_at=invitation.expires_at
    )


@router.post("/accept")
async def accept_invitation(
    payload: AcceptInvitation, http_request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    """Public: create the account with the invited role, then open a session."""
    check_password_strength(payload.password)
    invitation = await _valid_invitation(db, payload.token)

    # An account created with this email since the invitation keeps its own role: nothing proves
    # it belongs to the invited person
    if (await db.execute(select(User.id).where(User.email == invitation.email))).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email. Connectez-vous, puis demandez à un responsable de changer votre rôle.",
        )

    now = datetime.now(timezone.utc)
    user = User(
        id=str(uuid.uuid4()),
        email=invitation.email,
        name=(payload.name or "").strip() or invitation.name,
        password_hash=hash_password(payload.password),
        role=invitation.role,
        last_login=now,
    )
    db.add(user)
    invitation.accepted_at = now
    await db.commit()
    await db.refresh(user)

    await audit.record(
        db, Actor(id=user.id, email=user.email, ip=client_ip(http_request)), "user.invite_accepted",
        f"Invitation acceptée : {user.email} ({ROLE_LABELS.get(user.role, user.role)})",
        target_type="user", target_id=user.id, details={"role": user.role, "invitation": invitation.id},
    )
    issue_session(response, user)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "idle_minutes": idle_minutes_for(user.role),
        },
    }
