from models.base import Base
from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func


class User(Base):
    __tablename__ = "users"

    id = Column(String(255), primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    # Bumped to invalidate every existing session of the account (e.g. after a password reset)
    token_version = Column(Integer, nullable=False, server_default="0", default=0)
    # Set while the account is suspended: no sign-in, every session refused
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    # Technical owner (the service provider, per the contract): visible to the whole team, cannot be
    # demoted or suspended by other admins, hands the role over himself (Utilisateurs tab)
    is_technical_owner = Column(Boolean, nullable=False, server_default="false", default=False)
    # Two-step sign-in with an authenticator app (Google Authenticator...): secrets stored encrypted
    totp_secret = Column(String(255), nullable=True)
    totp_pending = Column(String(255), nullable=True)  # scanned but not confirmed yet
    totp_enabled_at = Column(DateTime(timezone=True), nullable=True)
    totp_last_step = Column(Integer, nullable=True)  # a code is accepted once only
    totp_recovery = Column(JSON, nullable=True)  # hashes of the unused recovery codes

    @property
    def two_factor(self) -> bool:
        return bool(self.totp_secret)