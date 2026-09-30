"""Session cookie issuing and sliding expiration (idle timeout).

The token lives in an httpOnly cookie. It expires after a period of inactivity that depends
on the role (shorter for admins); every authenticated request re-issues it with a fresh
expiry, up to an absolute limit counted from the login ("auth_time").
"""

import time
from typing import Optional

from core.auth import create_access_token
from core.config import settings
from fastapi import Response

# Re-issue at most once a minute: avoids a new cookie on every request
REFRESH_MARGIN_SECONDS = 60


# Accounts that see the dashboard (donor data) get the short idle timeout
STAFF_ROLES = ("member", "treasurer", "president", "admin")


def idle_minutes_for(role: Optional[str]) -> int:
    return int(settings.admin_idle_minutes) if role in STAFF_ROLES else int(settings.jwt_expire_minutes)


def _expiry(role: Optional[str], auth_time: int, now: int) -> int:
    """Seconds of validity for a new token: the idle window, capped by the absolute session limit."""
    idle = idle_minutes_for(role) * 60
    absolute_end = auth_time + int(settings.session_max_hours) * 3600
    return max(0, min(idle, absolute_end - now))


def issue_session(response: Response, user, auth_time: Optional[int] = None) -> None:
    """Set a fresh session cookie for `user`. `auth_time` (login time) is kept across refreshes."""
    now = int(time.time())
    auth_time = auth_time or now
    ttl = _expiry(user.role, auth_time, now)
    token = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.name,
            "tv": user.token_version,  # session version: bumping it logs out every session
            "auth_time": auth_time,
        },
        expires_minutes=ttl / 60,
    )
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=ttl,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


def session_expired(payload: dict, now: Optional[int] = None) -> bool:
    """True once the absolute limit after login is reached."""
    now = now or int(time.time())
    auth_time = int(payload.get("auth_time") or payload.get("iat") or 0)
    return now >= auth_time + int(settings.session_max_hours) * 3600


def needs_refresh(payload: dict, role: Optional[str], now: Optional[int] = None) -> bool:
    """Refresh when the remaining validity is noticeably shorter than a full idle window, or longer
    (the account was promoted to admin: it must switch to the shorter admin idle window)."""
    now = now or int(time.time())
    remaining = int(payload.get("exp", 0)) - now
    idle = idle_minutes_for(role) * 60
    return remaining < idle - REFRESH_MARGIN_SECONDS or remaining > idle + REFRESH_MARGIN_SECONDS
