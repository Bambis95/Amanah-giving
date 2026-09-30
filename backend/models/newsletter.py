from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func


class Subscriber(Base):
    """Someone who asked to receive SENJAPO news by email (explicit consent only).

    Created from the "keep me informed" form or the opt-in box of the donation form, never by hand.
    `token` is the secret of the one-click unsubscribe link carried by every newsletter.
    """

    __tablename__ = "newsletter_subscribers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    source = Column(String(30), nullable=False)  # "notify" or "donation"
    token = Column(String(64), nullable=False, unique=True, index=True)
    consent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)


class NewsletterIssue(Base):
    """A newsletter sent from the dashboard (history)."""

    __tablename__ = "newsletter_issues"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subject = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    recipients = Column(Integer, nullable=False, default=0)
    sent_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
