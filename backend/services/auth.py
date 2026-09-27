import bcrypt
import logging
import os

from core.config import settings
from core.database import db_manager
from models.auth import User
from sqlalchemy import select

logger = logging.getLogger(__name__)


async def initialize_admin_user():
    """Initialize admin user if not exists"""
    if "MGX_IGNORE_INIT_ADMIN" in os.environ:
        logger.info("Ignore initialize admin")
        return

    from services.database import initialize_database

    # Ensure database is initialized first
    await initialize_database()

    admin_user_id = getattr(settings, "admin_user_id", "")
    admin_user_email = getattr(settings, "admin_user_email", "")

    if not admin_user_id or not admin_user_email:
        logger.warning("Admin user ID or email not configured, skipping admin initialization")
        return

    async with db_manager.async_session_maker() as db:
        # Check if admin user already exists
        result = await db.execute(select(User).where(User.id == admin_user_id))
        user = result.scalar_one_or_none()

        if user:
            # Update existing user to admin if not already
            if user.role != "admin":
                user.role = "admin"
                user.email = admin_user_email  # Update email too
                await db.commit()
                logger.debug(f"Updated user {admin_user_id} to admin role")
            else:
                logger.debug(f"Admin user {admin_user_id} already exists")
        else:
            # Users need a password, so the admin account must first be created via /register
            logger.warning(
                f"Admin user {admin_user_id} not found; register the account first, it will be promoted on next startup"
            )
def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8")
    )
async def register_user(db, email: str, password: str, name: str | None = None):
    from sqlalchemy import select
    from models.auth import User
    import uuid

    result = await db.execute(
        select(User).where(User.email == email.lower())
    )

    if result.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=email.lower(),
        name=name,
        password_hash=hash_password(password),
        role="user",
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


