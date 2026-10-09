"""Authenticator app (Google Authenticator...) for one's own account: turn on, recovery codes, turn off.

Any account can turn it on from "Mon espace". Turning on needs a code from the app (proves the QR
code was scanned); turning off needs the password and a code. An admin can remove it from someone
who lost their phone and their recovery codes (never from the technical owner).
"""

from datetime import datetime, timezone
from typing import List

from core.database import get_db
from dependencies.auth import client_ip, get_admin_actor, get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from models.auth import User
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services import audit, totp
from services.audit import Actor
from services.auth import verify_password
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth/2fa", tags=["two-factor"])
admin_router = APIRouter(prefix="/api/v1/users", tags=["two-factor"])


class Status(BaseModel):
    enabled: bool
    enabled_at: datetime | None = None
    recovery_left: int = 0


class Setup(BaseModel):
    secret: str  # to type by hand when the QR code cannot be scanned
    otpauth_uri: str  # what the QR code carries


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=20)


class DisableIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=6, max_length=20)


class RecoveryOut(BaseModel):
    recovery_codes: List[str]


async def _me(db: AsyncSession, current: UserResponse) -> User:
    user = await db.get(User, current.id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expirée")
    return user


def _status(user: User) -> Status:
    return Status(enabled=totp.enabled(user), enabled_at=user.totp_enabled_at, recovery_left=len(user.totp_recovery or []))


@router.get("", response_model=Status)
async def status(db: AsyncSession = Depends(get_db), current: UserResponse = Depends(get_current_user)):
    return _status(await _me(db, current))


@router.post("/setup", response_model=Setup)
async def setup(db: AsyncSession = Depends(get_db), current: UserResponse = Depends(get_current_user)):
    """A new secret to scan; it only takes effect once confirmed with a code from the app."""
    user = await _me(db, current)
    if totp.enabled(user):
        raise HTTPException(status_code=409, detail="La double authentification est déjà activée.")
    secret = totp.new_secret()
    user.totp_pending = totp.encrypt(secret)
    await db.commit()
    return Setup(secret=secret, otpauth_uri=totp.provisioning_uri(secret, user.email))


@router.post("/enable", response_model=RecoveryOut)
async def enable(payload: CodeIn, request: Request, db: AsyncSession = Depends(get_db), current: UserResponse = Depends(get_current_user)):
    user = await _me(db, current)
    secret = totp.decrypt(user.totp_pending)
    if not secret:
        raise HTTPException(status_code=400, detail="Scannez d'abord le QR code.")
    step = totp.matching_step(secret, payload.code, None)
    if step is None:
        raise HTTPException(status_code=400, detail="Code incorrect. Vérifiez l'heure du téléphone et saisissez le code affiché.")
    codes, hashes = totp.new_recovery_codes()
    user.totp_secret, user.totp_pending = user.totp_pending, None
    user.totp_last_step, user.totp_recovery = step, hashes
    user.totp_enabled_at = datetime.now(timezone.utc)
    await db.commit()
    await audit.record(
        db, Actor(id=user.id, email=user.email, ip=client_ip(request)), "security.2fa_enabled",
        f"Double authentification activée : {user.email}", target_type="user", target_id=user.id,
    )
    return RecoveryOut(recovery_codes=codes)


@router.post("/recovery-codes", response_model=RecoveryOut)
async def new_recovery_codes(payload: CodeIn, request: Request, db: AsyncSession = Depends(get_db), current: UserResponse = Depends(get_current_user)):
    """New recovery codes (the old ones stop working); needs a current code from the app."""
    user = await _me(db, current)
    if not totp.enabled(user):
        raise HTTPException(status_code=400, detail="La double authentification n'est pas activée.")
    if totp.check_code(user, payload.code) != "totp":
        await db.rollback()
        raise HTTPException(status_code=400, detail="Code incorrect.")
    codes, hashes = totp.new_recovery_codes()
    user.totp_recovery = hashes
    await db.commit()
    await audit.record(
        db, Actor(id=user.id, email=user.email, ip=client_ip(request)), "security.2fa_recovery_renewed",
        f"Nouveaux codes de secours : {user.email}", target_type="user", target_id=user.id,
    )
    return RecoveryOut(recovery_codes=codes)


def _clear(user: User) -> None:
    user.totp_secret = user.totp_pending = None
    user.totp_enabled_at = user.totp_last_step = None
    user.totp_recovery = None


@router.post("/disable", response_model=Status)
async def disable(payload: DisableIn, request: Request, db: AsyncSession = Depends(get_db), current: UserResponse = Depends(get_current_user)):
    user = await _me(db, current)
    if not totp.enabled(user):
        return _status(user)
    if not verify_password(payload.password, user.password_hash) or not totp.check_code(user, payload.code):
        await db.rollback()
        raise HTTPException(status_code=400, detail="Mot de passe ou code incorrect.")
    _clear(user)
    await db.commit()
    await audit.record(
        db, Actor(id=user.id, email=user.email, ip=client_ip(request)), "security.2fa_disabled",
        f"Double authentification désactivée : {user.email}", target_type="user", target_id=user.id,
    )
    return _status(user)


@admin_router.post("/{user_id}/2fa/reset")
async def reset_for_user(user_id: str, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)):
    """Admins: remove the authenticator of someone who lost their phone and recovery codes."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if user.id == actor.id:
        raise HTTPException(status_code=400, detail="Utilisez « Mon espace » pour votre propre compte.")
    if user.is_technical_owner:
        raise HTTPException(status_code=403, detail="La double authentification du propriétaire technique ne peut être retirée que par lui-même.")
    if not totp.enabled(user):
        return {"enabled": False}
    _clear(user)
    # Sessions opened with the old protection end: the person signs in again
    user.token_version = (user.token_version or 0) + 1
    await db.commit()
    await audit.record(
        db, actor, "security.2fa_reset",
        f"Double authentification retirée par un administrateur : {user.email}", target_type="user", target_id=user.id,
    )
    return {"enabled": False}
