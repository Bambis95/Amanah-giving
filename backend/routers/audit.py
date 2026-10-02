from datetime import datetime
from typing import Any, List, Literal, Optional

from core.database import get_db
from dependencies.auth import get_manager_user
from fastapi import APIRouter, Depends, Query
from models.audit_log import AuditLog
from pydantic import BaseModel
from schemas.auth import UserResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from services import audit

# Read-only on purpose: the audit log has no update or delete endpoint
router = APIRouter(prefix="/api/v1/admin/audit-logs", tags=["audit"])


class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    summary: str
    details: Optional[Any] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogPage(BaseModel):
    items: List[AuditLogResponse]
    # Pass as `before_id` to load the next (older) page; None when there is nothing older
    next_before_id: Optional[int] = None


class ChainCheck(BaseModel):
    intact: bool
    checked: int
    unsealed_before: int
    first_broken_id: Optional[int] = None
    last_seal: Optional[str] = None


@router.get("/verify", response_model=ChainCheck)
async def verify_audit_chain(db: AsyncSession = Depends(get_db), _admin: UserResponse = Depends(get_manager_user)):
    """Recompute the seals: proves that no entry was changed or removed (compare last_seal with a saved copy)."""
    return await audit.verify_chain(db)


@router.get("", response_model=AuditLogPage)
async def list_audit_logs(
    category: Optional[Literal["project", "donation", "message", "user", "setting", "security", "finance"]] = None,
    before_id: Optional[int] = Query(None, description="Return entries older than this id"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: UserResponse = Depends(get_manager_user),
):
    """Most recent audit entries first (admins only)."""
    query = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit + 1)
    if category:
        query = query.where(AuditLog.action.like(f"{category}.%"))
    if before_id:
        query = query.where(AuditLog.id < before_id)
    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]
    return AuditLogPage(items=items, next_before_id=items[-1].id if has_more else None)
