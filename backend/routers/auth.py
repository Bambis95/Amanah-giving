import hashlib
import logging
import math
import secrets
from datetime import datetime, timedelta, timezone

from core.auth import create_access_token
from core.config import settings
from core.database import get_db
from dependencies.auth import client_ip, get_current_user
from services import audit
from services.audit import Actor
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from models.auth import User
from models.password_reset import PasswordResetToken
from pydantic import BaseModel, EmailStr
from schemas.auth import UserResponse
from services.auth import hash_password, register_user, verify_password
from services.email import build_password_reset_email, email_enabled, send_email
from services.login_throttle import clear_failures, record_failure, seconds_until_allowed
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Hash compared against when the email is unknown, to keep response times identical
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))

MIN_PASSWORD_LENGTH = 8
RESET_TOKEN_MINUTES = 60
RESET_REQUESTS_PER_HOUR = 3


def check_password_strength(password: str) -> None:
    """Server-side rule: the frontend check alone can be bypassed by calling the API directly."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Le mot de passe doit contenir au moins {MIN_PASSWORD_LENGTH} caractères.",
        )


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/register")
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    check_password_strength(request.password)
    try:
        user = await register_user(
            db,
            email=request.email,
            password=request.password,
            name=request.name,
        )
        return {
            "message": "Account created successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.post("/login")
async def login(
    request: LoginRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email = request.email.lower()
    ip = client_ip(http_request)

    # Checked before the password: during a lock even the right password is refused,
    # otherwise an attacker could keep guessing. Unknown emails are throttled too.
    wait = await seconds_until_allowed(db, email, ip)
    if wait:
        minutes = math.ceil(wait / 60)
        raise HTTPException(
            status_code=429,
            detail=f"Trop de tentatives de connexion. Réessayez dans {minutes} minute{'s' if minutes > 1 else ''}.",
            headers={"Retry-After": str(wait)},
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always run bcrypt so an unknown email answers as slowly as a wrong password
    password_ok = verify_password(request.password, user.password_hash if user else DUMMY_PASSWORD_HASH)

    if not user or not password_ok:
        await record_failure(db, email, ip)
        # Allowed before this failure, blocked after it: the lock starts now, log it once
        if await seconds_until_allowed(db, email, ip):
            await audit.record(
                db, Actor(ip=ip), "security.login_locked",
                f"Connexion bloquée 15 min après trop d'échecs : {email}",
                target_type="user", target_id=user.id if user else None,
                details={"email": email, "compte_existant": user is not None},
            )
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    await clear_failures(db, email)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.name,
            "tv": user.token_version,  # session version: bumping it logs out every session
        }
    )
    # The token lives only in an httpOnly cookie: page scripts (and an XSS) cannot read it
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=int(settings.jwt_expire_minutes) * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    }


@router.post("/logout")
async def logout(response: Response):
    """End the session in this browser by deleting the cookie."""
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )
    return {"message": "Déconnecté"}


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Email a one-time reset link. The answer never reveals whether the email has an account."""
    generic = {
        "message": "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."
    }

    user = (
        await db.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if not user:
        return generic

    now = datetime.now(timezone.utc)
    recent = (
        await db.execute(
            select(func.count(PasswordResetToken.id)).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.created_at > now - timedelta(hours=1),
            )
        )
    ).scalar_one()
    if recent >= RESET_REQUESTS_PER_HOUR:
        logger.warning("Password reset rate limit reached for user %s", user.id)
        return generic

    if not email_enabled():
        logger.error("Password reset requested but SMTP is not configured")
        return generic

    # Only the newest link stays valid
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(token),
            expires_at=now + timedelta(minutes=RESET_TOKEN_MINUTES),
        )
    )
    await db.commit()

    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    message = build_password_reset_email(user.email, user.name, reset_url, RESET_TOKEN_MINUTES)
    background_tasks.add_task(send_email, message, f"password reset for user {user.id}")
    return generic


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, http_request: Request, db: AsyncSession = Depends(get_db)):
    """Set a new password from a valid, unused, unexpired reset link."""
    check_password_strength(payload.password)

    now = datetime.now(timezone.utc)
    reset = (
        await db.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_reset_token(payload.token))
        )
    ).scalar_one_or_none()
    if not reset or reset.used_at is not None or reset.expires_at <= now:
        raise HTTPException(
            status_code=400,
            detail="Ce lien est invalide ou a expiré. Faites une nouvelle demande.",
        )

    user = await db.get(User, reset.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Ce lien est invalide ou a expiré. Faites une nouvelle demande.")

    user.password_hash = hash_password(payload.password)
    # Every session opened with the old password stops working (e.g. a stolen session)
    user.token_version = (user.token_version or 0) + 1
    # This link and any other pending one can no longer be used
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    await db.commit()
    # The owner proved access to the mailbox: lift any login lock on the account
    await clear_failures(db, user.email)
    await audit.record(
        db, Actor(id=user.id, email=user.email, ip=client_ip(http_request)), "security.password_reset",
        f"Mot de passe réinitialisé par lien email : {user.email}",
        target_type="user", target_id=user.id,
    )
    logger.info("Password reset completed for user %s", user.id)
    return {"message": "Votre mot de passe a été modifié. Vous pouvez vous connecter."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user
