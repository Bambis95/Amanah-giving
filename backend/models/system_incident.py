"""Problems of the platform seen by the server (crashes, payment or email outages, overload), for the admins.

The same problem happening again while still open adds to its counter instead of creating a new line;
once resolved, a new occurrence opens a new incident.
"""

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func


class SystemIncident(Base):
    __tablename__ = "system_incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Same problem, same fingerprint (e.g. "error:KeyError:/api/v1/site")
    fingerprint = Column(String(64), nullable=False, index=True)
    # error, payment, email, database, memory, cpu, slow, restart, client, backup, test
    kind = Column(String(20), nullable=False)
    severity = Column(String(10), nullable=False)  # critical, warning, info
    title = Column(String(200), nullable=False)
    detail = Column(Text, nullable=True)
    path = Column(String(200), nullable=True)
    count = Column(Integer, nullable=False, default=1)
    first_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    emailed_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True, index=True)
    resolved_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_note = Column(String(500), nullable=True)
