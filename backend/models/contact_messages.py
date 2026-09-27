from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String, func


class Contact_messages(Base):
    __tablename__ = "contact_messages"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)