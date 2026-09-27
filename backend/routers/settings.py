import re
from pathlib import Path
from typing import Dict, Literal

from core.database import get_db
from dependencies.auth import get_admin_actor, get_admin_user
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from schemas.auth import UserResponse
from services import audit
from services.audit import Actor
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/admin/settings", tags=["admin-settings"])

EnvType = Literal["backend", "frontend"]

KEY_PATTERN = re.compile(r"^[A-Z_][A-Z0-9_]*$")
# Any key containing one of these words holds a secret and is never sent back in clear
SECRET_MARKERS = ("SECRET", "PASSWORD", "TOKEN", "KEY", "PRIVATE")
MASK = "••••••••"


class EnvVariable(BaseModel):
    key: str
    value: str  # masked for secrets
    description: str = ""
    is_secret: bool = False
    is_set: bool = True


class EnvConfig(BaseModel):
    backend_vars: Dict[str, EnvVariable]
    frontend_vars: Dict[str, EnvVariable]


class EnvVariableUpdate(BaseModel):
    value: str


BACKEND_DESCRIPTIONS = {
    "DATABASE_URL": "Database connection string",
    "STRIPE_SECRET_KEY": "Stripe secret key",
    "STRIPE_SUCCESS_URL": "Payment success callback URL",
    "STRIPE_CANCEL_URL": "Payment cancellation callback URL",
    "ALLOWED_DOMAINS": "Allowed domains",
    "HOST": "Server host address",
    "PORT": "Server port",
    "FRONTEND_URL": "Frontend URL",
    "JWT_SECRET_KEY": "JWT signing secret key",
    "JWT_ALGORITHM": "JWT signing algorithm",
    "JWT_EXPIRE_MINUTES": "JWT expiration time (minutes)",
    "ADMIN_USER_ID": "Admin user ID",
    "ADMIN_USER_EMAIL": "Admin user email",
    "SMTP_HOST": "SMTP server for confirmation emails",
    "SMTP_PASSWORD": "SMTP password",
    "EMAIL_FROM": "Sender address of emails",
}
FRONTEND_DESCRIPTIONS = {"VITE_API_BASE_URL": "Base API URL", "VITE_FRONTEND_URL": "Frontend URL"}


def get_env_file_path(env_type: EnvType) -> Path:
    """Get the path to the environment variable file."""
    base_path = Path(__file__).parent.parent
    if env_type == "backend":
        return base_path / ".env"
    return base_path.parent / "frontend" / ".env"


def _key_line(key: str) -> re.Pattern:
    return re.compile(rf"^\s*{re.escape(key)}\s*=")


def read_env_file(env_type: EnvType) -> Dict[str, str]:
    """Read an environment variable file."""
    env_file = get_env_file_path(env_type)
    if not env_file.exists():
        return {}

    env_vars = {}
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()
    return env_vars


def _read_lines(env_type: EnvType) -> list:
    env_file = get_env_file_path(env_type)
    if not env_file.exists():
        return []
    return env_file.read_text(encoding="utf-8").splitlines(keepends=True)


def _write_lines(env_type: EnvType, lines: list) -> None:
    env_file = get_env_file_path(env_type)
    env_file.parent.mkdir(parents=True, exist_ok=True)
    env_file.write_text("".join(lines), encoding="utf-8")


def set_env_value(env_type: EnvType, key: str, value: str) -> bool:
    """Set a key in place, keeping comments, blank lines and order. Returns True if the key existed."""
    lines = _read_lines(env_type)
    pattern = _key_line(key)
    for i, line in enumerate(lines):
        if pattern.match(line):
            newline = "\n" if line.endswith("\n") else ""
            lines[i] = f"{key}={value}{newline}"
            _write_lines(env_type, lines)
            return True
    if lines and not lines[-1].endswith("\n"):
        lines[-1] += "\n"
    lines.append(f"{key}={value}\n")
    _write_lines(env_type, lines)
    return False


def remove_env_value(env_type: EnvType, key: str) -> bool:
    """Remove a key's line(s), keeping the rest of the file untouched. Returns True if it existed."""
    lines = _read_lines(env_type)
    pattern = _key_line(key)
    kept = [line for line in lines if not pattern.match(line)]
    if len(kept) == len(lines):
        return False
    _write_lines(env_type, kept)
    return True


def is_secret(key: str) -> bool:
    return key == "DATABASE_URL" or any(marker in key.upper() for marker in SECRET_MARKERS)


def masked_value(key: str, value: str) -> str:
    if not value:
        return ""
    if key == "DATABASE_URL":
        # Keep the address readable, hide only the password: scheme://user:••••••••@host/db
        return re.sub(r"(://[^:/@]+:)[^@]*@", rf"\g<1>{MASK}@", value)
    return MASK if is_secret(key) else value


def validate_setting(key: str, value: str | None = None) -> None:
    if not KEY_PATTERN.match(key):
        raise HTTPException(
            status_code=400,
            detail="Nom de paramètre invalide : lettres majuscules, chiffres et _ uniquement (ex. SMTP_HOST).",
        )
    # A line break would let a value inject extra settings into the file
    if value is not None and ("\n" in value or "\r" in value):
        raise HTTPException(status_code=400, detail="La valeur ne peut pas contenir de retour à la ligne.")


def _build(env_type: EnvType, descriptions: Dict[str, str]) -> Dict[str, EnvVariable]:
    return {
        key: EnvVariable(
            key=key,
            value=masked_value(key, value),
            description=descriptions.get(key, ""),
            is_secret=is_secret(key),
            is_set=bool(value),
        )
        for key, value in read_env_file(env_type).items()
    }


@router.get("", response_model=EnvConfig)
async def get_settings(current_user: UserResponse = Depends(get_admin_user)):
    """Retrieve environment variable configuration. Secret values are masked, never returned in clear."""
    try:
        return EnvConfig(
            backend_vars=_build("backend", BACKEND_DESCRIPTIONS),
            frontend_vars=_build("frontend", FRONTEND_DESCRIPTIONS),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read configuration: {str(e)}")


async def _set(env_type: EnvType, key: str, value: str, actor: Actor, db: AsyncSession) -> dict:
    validate_setting(key, value)
    try:
        existed = set_env_value(env_type, key, value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {str(e)}")
    # Only the key is logged, never the value: it may be a password or an API key
    await audit.record(
        db, actor, "setting.update" if existed else "setting.create",
        f"Paramètre {env_type} {'modifié' if existed else 'ajouté'} : {key}",
        target_type="setting", target_id=f"{env_type}:{key}",
    )
    word = "updated" if existed else "added"
    return {"message": f"{env_type.capitalize()} configuration '{key}' {word} successfully; restart required to take effect."}


async def _delete(env_type: EnvType, key: str, actor: Actor, db: AsyncSession) -> dict:
    validate_setting(key)
    try:
        existed = remove_env_value(env_type, key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")
    if not existed:
        raise HTTPException(status_code=404, detail=f"Configuration item '{key}' does not exist")
    await audit.record(
        db, actor, "setting.delete", f"Paramètre {env_type} supprimé : {key}",
        target_type="setting", target_id=f"{env_type}:{key}",
    )
    return {"message": f"{env_type.capitalize()} configuration '{key}' deleted successfully; restart required to take effect."}


@router.put("/backend/{key}")
async def update_backend_setting(
    key: str, update: EnvVariableUpdate, actor: Actor = Depends(get_admin_actor), db: AsyncSession = Depends(get_db)
):
    """Update (or add) a backend environment variable."""
    return await _set("backend", key, update.value, actor, db)


@router.put("/frontend/{key}")
async def update_frontend_setting(
    key: str, update: EnvVariableUpdate, actor: Actor = Depends(get_admin_actor), db: AsyncSession = Depends(get_db)
):
    """Update (or add) a frontend environment variable."""
    return await _set("frontend", key, update.value, actor, db)


@router.post("/backend/{key}")
async def add_backend_setting(
    key: str, update: EnvVariableUpdate, actor: Actor = Depends(get_admin_actor), db: AsyncSession = Depends(get_db)
):
    """Add (or update) a backend environment variable."""
    return await _set("backend", key, update.value, actor, db)


@router.post("/frontend/{key}")
async def add_frontend_setting(
    key: str, update: EnvVariableUpdate, actor: Actor = Depends(get_admin_actor), db: AsyncSession = Depends(get_db)
):
    """Add (or update) a frontend environment variable."""
    return await _set("frontend", key, update.value, actor, db)


@router.delete("/backend/{key}")
async def delete_backend_setting(key: str, actor: Actor = Depends(get_admin_actor), db: AsyncSession = Depends(get_db)):
    """Delete a backend environment variable."""
    return await _delete("backend", key, actor, db)


@router.delete("/frontend/{key}")
async def delete_frontend_setting(key: str, actor: Actor = Depends(get_admin_actor), db: AsyncSession = Depends(get_db)):
    """Delete a frontend environment variable."""
    return await _delete("frontend", key, actor, db)
