from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func


class Invitation(Base):
    """Staff invitation: an emailed one-time link to create an account that already has its role.

    Only a SHA-256 hash of the token is stored. An invitation is pending while it is neither
    accepted, revoked nor expired.
    """

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    invited_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
