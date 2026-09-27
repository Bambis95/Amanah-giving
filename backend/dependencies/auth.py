import logging
from typing import Optional, Tuple

from core.auth import AccessTokenError, decode_access_token
from core.config import settings
from core.database import get_db
from core.session import issue_session, needs_refresh, session_expired
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.auth import User
from schemas.auth import UserResponse
from services.audit import Actor
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _session_token(
    request: Request, credentials: Optional[HTTPAuthorizationCredentials]
) -> Tuple[Optional[str], bool]:
    """(token, from_cookie). The httpOnly cookie is what the website uses; the header stays for API clients."""
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials, False
    return request.cookies.get(settings.session_cookie_name), True


def _check_origin(request: Request) -> None:
    """CSRF defence for cookie sessions: a state-changing request must come from our own frontend.

    Browsers attach cookies automatically, so without this another website could make a
    logged-in visitor's browser perform actions. SameSite=Lax already blocks most cases;
    this closes the rest (e.g. older browsers, subdomains).
    """
    if request.method in SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin is None:
        return  # same-origin requests from some clients omit it; cross-site browser requests always send it
    own_origin = f"{request.url.scheme}://{request.url.netloc}"
    if origin.rstrip("/") not in settings.allowed_origins and origin.rstrip("/") != own_origin:
        logger.warning("Blocked cross-site request with origin %s to %s", origin, request.url.path)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origine de la requête non autorisée")


SESSION_EXPIRED = "Session expirée, veuillez vous reconnecter"


async def _load_user(token: str, db: AsyncSession, response: Optional[Response] = None) -> UserResponse:
    """Validate the token and the account. With `response` (cookie session), slide the expiry."""
    try:
        payload = decode_access_token(token)
    except AccessTokenError as exc:
        # Expired token = idle timeout reached. Log the error type only, never token data.
        logger.info("Token validation failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESSION_EXPIRED)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    # The account is read on every request: a deleted account, a changed role or an
    # invalidated session (password reset) takes effect immediately, not at token expiry.
    user = await db.get(User, user_id)
    if not user or payload.get("tv", 0) != user.token_version or session_expired(payload):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=SESSION_EXPIRED)

    # Activity extends the session (sliding idle timeout), within the absolute limit
    if response is not None and needs_refresh(payload, user.role):
        auth_time = int(payload.get("auth_time") or payload.get("iat") or 0) or None
        issue_session(response, user, auth_time=auth_time)

    return UserResponse(id=user.id, email=user.email, name=user.name, role=user.role, last_login=user.last_login)


async def get_current_user(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Dependency to get the authenticated user from the session cookie (or a bearer token)."""
    token, from_cookie = _session_token(request, credentials)
    if not token:
        logger.debug("Authentication required for request %s %s", request.method, request.url.path)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication credentials were not provided")
    if from_cookie:
        _check_origin(request)
    return await _load_user(token, db, response if from_cookie else None)


async def get_optional_user(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserResponse]:
    """Return the authenticated user if a valid session is sent, otherwise None (anonymous access)."""
    token, from_cookie = _session_token(request, credentials)
    if not token:
        return None
    if from_cookie:
        _check_origin(request)
    try:
        return await _load_user(token, db, response if from_cookie else None)
    except HTTPException:
        # An expired or invalid session must not block an anonymous action
        logger.info("Ignoring invalid session on optional authentication")
        return None


async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Dependency to ensure current user has admin role (read from the database, so demotion is immediate)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def get_admin_actor(request: Request, admin: UserResponse = Depends(get_admin_user)) -> Actor:
    """Admin check plus who/where, for the audit log."""
    return Actor(id=admin.id, email=admin.email, ip=client_ip(request))
