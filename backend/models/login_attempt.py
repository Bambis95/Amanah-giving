from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, func


class LoginAttempt(Base):
    """A failed login, used to throttle brute-force attempts per email and per IP address."""

    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
