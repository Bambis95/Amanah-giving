from datetime import datetime, timezone
from typing import List, Literal, Optional

from core.database import get_db
from dependencies.auth import client_ip, get_current_user, get_manager_user
from services import audit
from services.audit import Actor
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.auth import User
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.user import UserService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None


class AdminUserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    suspended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SuspensionRequest(BaseModel):
    suspended: bool


class UpdateRoleRequest(BaseModel):
    role: Literal["user", "member", "president", "admin"]


ROLE_LABELS = {"user": "utilisateur", "member": "membre du club", "president": "président", "admin": "administrateur"}
# What a president may grant or take away: membership only
PRESIDENT_MANAGED = ("user", "member")


@router.get("", response_model=List[AdminUserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _manager: UserResponse = Depends(get_manager_user),
):
    """List all accounts (president and admins)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.put("/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: str,
    payload: UpdateRoleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    manager: UserResponse = Depends(get_manager_user),
):
    """Change an account's role. Admins: any role. President: makes accounts members of the club or not."""
    # Changing your own role is refused: it guarantees at least one admin remains
    if user_id == manager.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas modifier votre propre rôle.",
        )
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    if manager.role != "admin" and (user.role not in PRESIDENT_MANAGED or payload.role not in PRESIDENT_MANAGED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un administrateur peut nommer ou retirer un président ou un administrateur.",
        )
    previous = user.role
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    if previous != user.role:
        actor = Actor(id=manager.id, email=manager.email, ip=client_ip(request))
        await audit.record(
            db, actor, "user.role_change",
            f"{user.email} : {ROLE_LABELS.get(previous, previous)} → {ROLE_LABELS.get(user.role, user.role)}",
            target_type="user", target_id=user.id,
            details={"role": {"avant": previous, "apres": user.role}},
        )
    return user


@router.put("/{user_id}/suspension", response_model=AdminUserResponse)
async def set_suspension(
    user_id: str,
    payload: SuspensionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    manager: UserResponse = Depends(get_manager_user),
):
    """Suspend or reactivate an account. Same reach as role changes: a president handles members only."""
    if user_id == manager.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vous ne pouvez pas suspendre votre propre compte.")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    if manager.role != "admin" and user.role not in PRESIDENT_MANAGED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un administrateur peut suspendre un président ou un administrateur.",
        )

    if payload.suspended and user.suspended_at is None:
        user.suspended_at = datetime.now(timezone.utc)
        # Every open session (phone, computer) stops at once
        user.token_version = (user.token_version or 0) + 1
        action, summary = "user.suspend", f"Compte suspendu : {user.email}"
    elif not payload.suspended and user.suspended_at is not None:
        user.suspended_at = None
        action, summary = "user.reactivate", f"Compte réactivé : {user.email}"
    else:
        return user  # already in the requested state
    await db.commit()
    await db.refresh(user)
    await audit.record(
        db, Actor(id=manager.id, email=manager.email, ip=client_ip(request)), action, summary,
        target_type="user", target_id=user.id,
    )
    return user


@router.get("/profile", response_model=UserResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    profile = await UserService.get_user_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user profile"""
    profile = await UserService.update_user_profile(db, current_user.id, profile_data.name)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile
