from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func


class ProjectUpdate(Base):
    """A dated piece of news about a campaign ("Les fondations sont posées"), shown to donors."""

    __tablename__ = "project_updates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    image = Column(String(500), nullable=True)
    published_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
