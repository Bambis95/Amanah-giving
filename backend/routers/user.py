from datetime import datetime
from typing import List, Literal, Optional

from core.database import get_db
from dependencies.auth import get_admin_actor, get_admin_user, get_current_user
from services import audit
from services.audit import Actor
from fastapi import APIRouter, Depends, HTTPException, status
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

    class Config:
        from_attributes = True


class UpdateRoleRequest(BaseModel):
    role: Literal["user", "admin"]


@router.get("", response_model=List[AdminUserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: UserResponse = Depends(get_admin_user),
):
    """List all accounts (admins only)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.put("/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: str,
    payload: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    actor: Actor = Depends(get_admin_actor),
):
    """Promote or demote an account (admins only)."""
    # Changing your own role is refused: it guarantees at least one admin remains
    if user_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas modifier votre propre rôle.",
        )
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    previous = user.role
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    if previous != user.role:
        await audit.record(
            db, actor, "user.role_change",
            f"{user.email} : {'promu administrateur' if user.role == 'admin' else 'droits administrateur retirés'}",
            target_type="user", target_id=user.id,
            details={"role": {"avant": previous, "apres": user.role}},
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
