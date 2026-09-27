import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, Iterable, Optional

from models.audit_log import AuditLog
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class Actor:
    """Who performs an action; id/email are None for anonymous or system events."""

    id: Optional[str] = None
    email: Optional[str] = None
    ip: Optional[str] = None


def _json_safe(value: Any) -> Any:
    return value.isoformat() if isinstance(value, (datetime, date)) else value


def snapshot(obj: Any, fields: Iterable[str]) -> Dict[str, Any]:
    """Plain, JSON-serialisable copy of some attributes of a model instance."""
    return {f: _json_safe(getattr(obj, f, None)) for f in fields}


def diff(before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Fields whose value changed, as {field: {"avant": old, "apres": new}}."""
    return {
        field: {"avant": before.get(field), "apres": after.get(field)}
        for field in after
        if before.get(field) != after.get(field)
    }


async def record(
    db: AsyncSession,
    actor: Actor,
    action: str,
    summary: str,
    target_type: Optional[str] = None,
    target_id: Any = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Append an audit entry. Never raises: a logging failure must not undo the action already done."""
    try:
        db.add(
            AuditLog(
                actor_id=actor.id,
                actor_email=actor.email,
                action=action,
                target_type=target_type,
                target_id=str(target_id) if target_id is not None else None,
                summary=summary,
                details=details or None,
                ip_address=actor.ip,
            )
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to write audit log entry %s", action)
        await db.rollback()
