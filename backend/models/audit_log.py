from core.database import Base
from sqlalchemy import JSON, Column, DateTime, Integer, String, Text, func


class AuditLog(Base):
    """Append-only record of admin and security actions: who did what, when, from where."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Actor snapshot: the email is kept even if the account is deleted later
    actor_id = Column(String(255), nullable=True, index=True)
    actor_email = Column(String(255), nullable=True)
    action = Column(String(64), nullable=False, index=True)  # e.g. "project.update"
    target_type = Column(String(32), nullable=True, index=True)
    target_id = Column(String(255), nullable=True)
    summary = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
