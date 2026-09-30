from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String, func


class StoredImage(Base):
    """Campaign photo uploaded from the dashboard, kept in the database (backed up with it).

    Stored already resized and re-encoded (no EXIF, so no GPS position of the phone).
    """

    __tablename__ = "images"

    id = Column(String(32), primary_key=True)  # random hex: the public URL cannot be guessed
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    size = Column(Integer, nullable=False)
    uploaded_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
