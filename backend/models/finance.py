"""Accounts of the platform: entries (income / expenses), campaign budgets, supporting documents.

Online donations are not copied into the entries: the finance summary reads the paid donations
directly, so the two can never disagree. Entries record everything else (cash gifts, grants,
membership fees, expenses...). An entry is never deleted, only cancelled with a reason.
"""

from core.database import Base
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, LargeBinary, String, func


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
