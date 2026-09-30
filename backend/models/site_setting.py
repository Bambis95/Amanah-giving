from core.database import Base
from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, func


class SiteSetting(Base):
    """One editable piece of the public site (contacts, social links, home texts), set from the dashboard."""

    __tablename__ = "site_settings"

    key = Column(String(50), primary_key=True)
    value = Column(JSON, nullable=True)
    updated_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
