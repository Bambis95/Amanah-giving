import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, Optional

from models.audit_log import AuditLog
from sqlalchemy import select, text
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


# Any constant: serialises the writers of the chain, so two entries never claim the same predecessor
_CHAIN_LOCK = 727274
GENESIS = "0" * 64


def compute_seal(previous: str, entry: AuditLog) -> str:
    """SHA-256 of the previous seal and of the entry's content (canonical JSON)."""
    created = entry.created_at.astimezone(timezone.utc).isoformat() if entry.created_at else None
    content = json.dumps(
        {
            "actor_id": entry.actor_id, "actor_email": entry.actor_email, "action": entry.action,
            "target_type": entry.target_type, "target_id": entry.target_id, "summary": entry.summary,
            "details": entry.details, "ip": entry.ip_address, "created_at": created,
        },
        sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str,
    )
    return hashlib.sha256(f"{previous}|{content}".encode("utf-8")).hexdigest()


async def record(
    db: AsyncSession,
    actor: Actor,
    action: str,
    summary: str,
    target_type: Optional[str] = None,
    target_id: Any = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Append a sealed audit entry. Never raises: a logging failure must not undo the action already done."""
    try:
        await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _CHAIN_LOCK})
        previous = (
            await db.execute(select(AuditLog.seal).where(AuditLog.seal.is_not(None)).order_by(AuditLog.id.desc()).limit(1))
        ).scalar_one_or_none() or GENESIS
        entry = AuditLog(
            actor_id=actor.id,
            actor_email=actor.email,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            summary=summary,
            details=details or None,
            ip_address=actor.ip,
            created_at=datetime.now(timezone.utc),
        )
        entry.seal = compute_seal(previous, entry)
        db.add(entry)
        await db.commit()
    except Exception:
        logger.exception("Failed to write audit log entry %s", action)
        await db.rollback()


async def verify_chain(db: AsyncSession) -> Dict[str, Any]:
    """Recompute every seal in order. Entries written before sealing existed are counted, not checked."""
    previous = GENESIS
    checked = unsealed = 0
    broken_id: Optional[int] = None
    last_seal: Optional[str] = None
    rows = await db.stream_scalars(select(AuditLog).order_by(AuditLog.id))
    async for entry in rows:
        if entry.seal is None:
            if checked:  # a seal missing after the chain started: removed by hand
                broken_id = broken_id or entry.id
            else:
                unsealed += 1
            continue
        if broken_id is None and compute_seal(previous, entry) != entry.seal:
            broken_id = entry.id
        previous = entry.seal
        last_seal = entry.seal
        checked += 1
    return {"intact": broken_id is None, "checked": checked, "unsealed_before": unsealed, "first_broken_id": broken_id, "last_seal": last_seal}
