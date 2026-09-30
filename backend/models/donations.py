
from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, func


class Donations(Base):
    __tablename__ = "donations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=True)  # None for anonymous donations
    project_id = Column(Integer, nullable=True)
    amount = Column(Integer, nullable=False)
    cause = Column(String, nullable=False)

    payment_method = Column(String, nullable=False)
    payment_status = Column(String, nullable=False)
    payment_provider = Column(String, nullable=True)
    payment_reference = Column(String, nullable=True)
    payment_checkout_url = Column(String, nullable=True)

    stripe_session_id = Column(String, nullable=True)

    paydunya_token = Column(String, nullable=True)

    donor_first_name = Column(String, nullable=True)
    donor_last_name = Column(String, nullable=True)
    donor_email = Column(String, nullable=True)
    donor_phone = Column(String, nullable=True)
    message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    # Checked by the treasurer against the operator's statement (PayTech, Wave, Orange Money)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    reconciled_by = Column(String, nullable=True)
  