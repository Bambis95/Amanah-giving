from models.base import Base
from sqlalchemy import Column, DateTime, Integer, String
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