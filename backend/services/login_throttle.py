import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from models.login_attempt import LoginAttempt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

WINDOW = timedelta(minutes=15)
MAX_FAILURES_PER_EMAIL = 5  # one account targeted
MAX_FAILURES_PER_IP = 20  # one machine trying many accounts
RETENTION = timedelta(days=1)


async def _retry_after(db: AsyncSession, column, value: str, limit: int, now: datetime) -> Optional[int]:
    """Seconds until the oldest of the last `limit` failures leaves the window, or None if under the limit."""
    recent = (
        await db.execute(
            select(LoginAttempt.created_at)
            .where(column == value, LoginAttempt.created_at > now - WINDOW)
            .order_by(LoginAttempt.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    if len(recent) < limit:
        return None
    return max(1, math.ceil((recent[-1] + WINDOW - now).total_seconds()))


async def seconds_until_allowed(db: AsyncSession, email: str, ip: Optional[str]) -> Optional[int]:
    """None when a login attempt may proceed, otherwise how long the caller must wait."""
    now = datetime.now(timezone.utc)
    waits = [await _retry_after(db, LoginAttempt.email, email, MAX_FAILURES_PER_EMAIL, now)]
    if ip:
        waits.append(await _retry_after(db, LoginAttempt.ip_address, ip, MAX_FAILURES_PER_IP, now))
    waits = [w for w in waits if w]
    return max(waits) if waits else None


async def record_failure(db: AsyncSession, email: str, ip: Optional[str]) -> None:
    now = datetime.now(timezone.utc)
    db.add(LoginAttempt(email=email, ip_address=ip))
    # Keep the table small: old failures no longer matter
    await db.execute(delete(LoginAttempt).where(LoginAttempt.created_at < now - RETENTION))
    await db.commit()


async def clear_failures(db: AsyncSession, email: str) -> None:
    """A successful login resets the counter of that account."""
    await db.execute(delete(LoginAttempt).where(LoginAttempt.email == email))
    await db.commit()
