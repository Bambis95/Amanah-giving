from core.database import Base
from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Integer, String, func


class Projects(Base):
    __tablename__ = "projects"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    image = Column(String, nullable=True)
    # More photos, shown with the full text ("Lire la suite"): a list of image URLs
    gallery = Column(JSON, nullable=True)
    category = Column(String, nullable=False)
    icon = Column(String, nullable=True)
    raised = Column(Integer, nullable=False)
    goal = Column(Integer, nullable=False)
    donors = Column(Integer, nullable=True)
    location = Column(String, nullable=True)
    urgent = Column(Boolean, nullable=True)
    is_featured = Column(Boolean, nullable=True)
    status = Column(String, nullable=True)
    # Last day of the fundraiser (optional): shown as a countdown, donations stay possible afterwards
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)