"""Email code, second sign-in step for presidents and admins (they see donors' contact details
and confirm deposits: a stolen password alone must not be enough)."""

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.config import settings
from models.auth import User
from models.login_code import LoginCode
from services import email as mail
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

ROLES_WITH_CODE = ("president", "admin")
CODE_MINUTES = 10
MAX_ATTEMPTS = 5


def required_for(user: User) -> bool:
    return settings.login_code_required and user.role in ROLES_WITH_CODE


def _challenge_hash(challenge: str) -> str:
    return hashlib.sha256(challenge.encode("utf-8")).hexdigest()


def _code_hash(challenge: str, code: str) -> str:
    # Keyed and bound to the challenge: a code is useless with another sign-in attempt
    message = f"{challenge}:{code}".encode("utf-8")
    return hmac.new(settings.jwt_secret_key.encode("utf-8"), message, hashlib.sha256).hexdigest()


def mask_email(address: str) -> str:
    local, _, domain = address.partition("@")
    return f"{local[:2]}{'•' * max(len(local) - 2, 1)}@{domain}"


async def start(db: AsyncSession, user: User) -> Optional[str]:
    """Create a code, email it and return the challenge; None when the email could not be sent."""
    now = datetime.now(timezone.utc)
    # Only the newest code of the account stays valid
    await db.execute(
        update(LoginCode).where(LoginCode.user_id == user.id, LoginCode.used_at.is_(None)).values(used_at=now)
    )
    challenge = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        LoginCode(
            user_id=user.id,
            challenge_hash=_challenge_hash(challenge),
            code_hash=_code_hash(challenge, code),
            expires_at=now + timedelta(minutes=CODE_MINUTES),
        )
    )
    await db.commit()

    if not mail.email_enabled():
        logger.warning("Login code skipped for user %s: SMTP is not configured", user.id)
        return None
    message = mail.build_login_code_email(user.email, user.name, code, CODE_MINUTES)
    if not await run_in_threadpool(mail.deliver, message, f"login code for user {user.id}"):
        return None
    return challenge


class CodeError(Exception):
    """Wrong, expired or exhausted code (message shown to the person)."""


async def verify(db: AsyncSession, challenge: str, code: str) -> User:
    """Return the account once the code matches; each wrong try counts, the fifth ends the attempt."""
    now = datetime.now(timezone.utc)
    entry = (
        await db.execute(select(LoginCode).where(LoginCode.challenge_hash == _challenge_hash(challenge)))
    ).scalar_one_or_none()
    if not entry or entry.used_at is not None or entry.expires_at <= now:
        raise CodeError("Ce code a expiré. Reconnectez-vous pour en recevoir un nouveau.")

    if not hmac.compare_digest(entry.code_hash, _code_hash(challenge, code.strip())):
        entry.attempts = (entry.attempts or 0) + 1
        left = MAX_ATTEMPTS - entry.attempts
        if left <= 0:
            entry.used_at = now
        await db.commit()
        if left <= 0:
            raise CodeError("Trop d'essais. Reconnectez-vous pour recevoir un nouveau code.")
        raise CodeError(f"Code incorrect. Il vous reste {left} essai{'s' if left > 1 else ''}.")

    entry.used_at = now
    await db.commit()
    user = await db.get(User, entry.user_id)
    if not user:
        raise CodeError("Ce code a expiré. Reconnectez-vous pour en recevoir un nouveau.")
    return user
