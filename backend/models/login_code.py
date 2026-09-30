from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func


class LoginCode(Base):
    """Second sign-in step for presidents and admins: a 6-digit code sent by email.

    The browser holds a random challenge; the database keeps only hashes of the challenge and of
    the code (bound to the challenge), so a database leak reveals neither.
    """

    __tablename__ = "login_codes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_hash = Column(String(64), nullable=False, unique=True, index=True)
    code_hash = Column(String(64), nullable=False)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
