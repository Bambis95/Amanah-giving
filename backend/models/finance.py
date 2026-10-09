"""Accounts of the platform: entries (income / expenses), campaign budgets, supporting documents.

Online donations are not copied into the entries: the finance summary reads the paid donations
directly, so the two can never disagree. Entries record everything else (cash gifts, grants,
membership fees, expenses...). An entry is never deleted, only cancelled with a reason.

Four eyes: an entry counts in the totals and reports only once validated by another member of the
finance team than the one who recorded it. A closed month can no longer change.
"""

from core.database import Base
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    kind = Column(String(10), nullable=False)  # "income" or "expense"
    entry_date = Column(Date, nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # FCFA, always positive; the kind gives the direction
    category = Column(String(50), nullable=False)
    label = Column(String(255), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_method = Column(String(30), nullable=False)
    reference = Column(String(100), nullable=True)  # invoice, receipt or transaction number
    document_id = Column(String(32), ForeignKey("finance_documents.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason = Column(String(255), nullable=True)
    # Validated by someone else of the finance team; None = waiting, not counted yet
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validated_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class FinanceDocument(Base):
    """Supporting document (invoice, receipt photo, bank statement): private to the finance team."""

    __tablename__ = "finance_documents"

    id = Column(String(32), primary_key=True)  # random hex
    filename = Column(String(200), nullable=False)
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    size = Column(Integer, nullable=False)
    uploaded_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ProjectBudgetLine(Base):
    """Planned spending of a campaign, line by line (e.g. "Construction des salles : 60 000 000")."""

    __tablename__ = "project_budget_lines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    planned_amount = Column(Integer, nullable=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FinanceClosure(Base):
    """A closed month ("2026-10"): its entries can no longer be created, changed or cancelled."""

    __tablename__ = "finance_closures"

    month = Column(String(7), primary_key=True)
    closed_by = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FinanceComment(Base):
    """Discussion between the treasurer and the accountant about one entry."""

    __tablename__ = "finance_comments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("finance_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String(255), nullable=True)  # kept even if the account goes
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
