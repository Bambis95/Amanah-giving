"""Two-step sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy...).

Standard TOTP (RFC 6238): a 6-digit code that changes every 30 seconds, computed from a secret
shared once through a QR code. The secret is stored encrypted (key derived from JWT_SECRET_KEY),
each code is accepted once, and 8 single-use recovery codes cover a lost phone.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from typing import List, Optional, Tuple
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from core.config import settings
from models.auth import User

STEP_SECONDS = 30
DIGITS = 6
# One step before and after: tolerates a phone clock a little off
WINDOW = 1
RECOVERY_COUNT = 8


def _fernet() -> Fernet:
    key = hashlib.sha256(f"totp:{settings.jwt_secret_key}".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(secret: str) -> str:
    return _fernet().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("ascii")
    except InvalidToken:
        return None


def new_secret() -> str:
    """160 random bits in base32, as authenticator apps expect."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def provisioning_uri(secret: str, account: str) -> str:
    """The otpauth:// link the QR code carries: the app shows "SENJAPO (email)"."""
    issuer = settings.site_short_name
    label = quote(f"{issuer}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits={DIGITS}&period={STEP_SECONDS}"


def _code_at(secret: str, step: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 10 ** DIGITS:0{DIGITS}d}"


def matching_step(secret: str, code: str, last_step: Optional[int], now: Optional[float] = None) -> Optional[int]:
    """The time step the code belongs to, or None. A step already used (replay) never matches again."""
    code = "".join(c for c in code if c.isdigit())
    if len(code) != DIGITS:
        return None
    current = int((now if now is not None else time.time()) // STEP_SECONDS)
    for step in range(current - WINDOW, current + WINDOW + 1):
        if last_step is not None and step <= last_step:
            continue
        if hmac.compare_digest(_code_at(secret, step), code):
            return step
    return None


# ---------- recovery codes ----------

def _recovery_hash(code: str) -> str:
    normal = "".join(c for c in code.lower() if c.isalnum())
    return hmac.new(settings.jwt_secret_key.encode("utf-8"), f"recovery:{normal}".encode("utf-8"), hashlib.sha256).hexdigest()


def new_recovery_codes() -> Tuple[List[str], List[str]]:
    """Codes to show once (e.g. "k7m2-p9xq") and their hashes to store."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: easy to copy by hand
    codes = ["".join(secrets.choice(alphabet) for _ in range(4)) + "-" + "".join(secrets.choice(alphabet) for _ in range(4))
             for _ in range(RECOVERY_COUNT)]
    return codes, [_recovery_hash(c) for c in codes]


def use_recovery_code(user: User, code: str) -> bool:
    """Consume a recovery code (the caller commits). Each one works once."""
    hashes = list(user.totp_recovery or [])
    digest = _recovery_hash(code)
    for stored in hashes:
        if hmac.compare_digest(stored, digest):
            hashes.remove(stored)
            user.totp_recovery = hashes
            return True
    return False


def enabled(user: User) -> bool:
    return bool(user.totp_secret)


def check_code(user: User, code: str) -> str:
    """Verify an app code or a recovery code; returns "totp", "recovery" or "" (wrong). Caller commits."""
    secret = decrypt(user.totp_secret)
    if secret:
        step = matching_step(secret, code, user.totp_last_step)
        if step is not None:
            user.totp_last_step = step
            return "totp"
    if any(c.isalpha() for c in code) and use_recovery_code(user, code):
        return "recovery"
    return ""
