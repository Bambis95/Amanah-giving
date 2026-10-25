"""Tontines (natt) and savings groups: the digital ledger of each association.

The platform never holds the money: members pay their treasurer (cash, Wave, Orange Money), the
treasurer deposits it on the association's own bank account. SENJAPO records every operation,
checks them (four eyes on deposits and payouts) and warns when something looks wrong.

- A group is "savings" (each member gets back what they paid for the period), "rotating" (each
  round, one member receives the whole pot, in the order of the rotation) or "mbootaay" (a common
  solidarity fund: the money stays in the fund and pays aids to members for a birth, a wedding,
  a death, an illness).
- Operations are never deleted: a wrong one is cancelled with a reason, visible in the journal.
"""

from core.database import Base
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, LargeBinary, String, func


class TontineGroup(Base):
    __tablename__ = "tontine_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    kind = Column(String(10), nullable=False)  # "savings", "rotating" or "mbootaay"
    amount = Column(Integer, nullable=False)  # FCFA expected from each member per period
    frequency = Column(String(10), nullable=False)  # "daily", "weekly" or "monthly"
    bank_name = Column(String(120), nullable=True)
    bank_account = Column(String(60), nullable=True)  # the association's own account (shown masked)
    # Alert when the treasurer keeps more than this in hand for more than so many days without a deposit
    cash_alert_amount = Column(Integer, nullable=False, default=50_000, server_default="50000")
    cash_alert_days = Column(Integer, nullable=False, default=7, server_default="7")
    created_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)


class TontineMember(Base):
    __tablename__ = "tontine_members"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("tontine_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True, index=True)  # links the member to their SENJAPO account
    user_id = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    role = Column(String(10), nullable=False, default="member")  # "member", "treasurer" or "president"
    rotation_order = Column(Integer, nullable=True)  # rotating groups: position in the turn order
    joined_at = Column(Date, nullable=False)
    left_at = Column(Date, nullable=True)


class TontineOperation(Base):
    """One line of the ledger: a contribution, a bank deposit or a payout to a member."""

    __tablename__ = "tontine_operations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("tontine_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(12), nullable=False)  # "contribution", "deposit" or "payout"
    member_id = Column(Integer, ForeignKey("tontine_members.id", ondelete="SET NULL"), nullable=True, index=True)
    op_date = Column(Date, nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # FCFA, always positive
    method = Column(String(20), nullable=False)  # cash, wave, orange_money, free_money, bank_transfer
    source = Column(String(10), nullable=True)  # payouts: paid from the treasurer's "cash" or the "bank"
    period = Column(String(10), nullable=True)  # payouts: "2026-10" (savings) or the round number (rotating)
    reference = Column(String(100), nullable=True)  # deposit slip or transaction number
    category = Column(String(20), nullable=True)  # mbootaay aids: birth, wedding, death, illness, other
    note = Column(String(255), nullable=True)  # what the aid or payout was for
    document_id = Column(String(32), ForeignKey("tontine_documents.id", ondelete="SET NULL"), nullable=True)
    recorded_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Deposits and payouts count only once validated by another officer of the group
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validated_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason = Column(String(255), nullable=True)


class TontineDocument(Base):
    """Photo of a bank deposit slip or a payout receipt, private to the group's officers."""

    __tablename__ = "tontine_documents"

    id = Column(String(32), primary_key=True)  # random hex
    group_id = Column(Integer, ForeignKey("tontine_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(200), nullable=False)
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    size = Column(Integer, nullable=False)
    uploaded_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
