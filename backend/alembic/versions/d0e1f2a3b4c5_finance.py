"""finance: entries, campaign budgets, supporting documents, donation reconciliation

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    # The app creates missing tables at startup, so some may already exist
    if not inspector.has_table("finance_documents"):
        op.create_table(
            "finance_documents",
            sa.Column("id", sa.String(length=32), nullable=False),
            sa.Column("filename", sa.String(length=200), nullable=False),
            sa.Column("content_type", sa.String(length=50), nullable=False),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            sa.Column("size", sa.Integer(), nullable=False),
            sa.Column("uploaded_by", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not inspector.has_table("finance_entries"):
        op.create_table(
            "finance_entries",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("kind", sa.String(length=10), nullable=False),
            sa.Column("entry_date", sa.Date(), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("label", sa.String(length=255), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("payment_method", sa.String(length=30), nullable=False),
            sa.Column("reference", sa.String(length=100), nullable=True),
            sa.Column("document_id", sa.String(length=32), nullable=True),
            sa.Column("created_by", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancelled_by", sa.String(length=255), nullable=True),
            sa.Column("cancel_reason", sa.String(length=255), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["document_id"], ["finance_documents.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["cancelled_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_finance_entries_id"), "finance_entries", ["id"], unique=False)
        op.create_index(op.f("ix_finance_entries_entry_date"), "finance_entries", ["entry_date"], unique=False)
        op.create_index(op.f("ix_finance_entries_project_id"), "finance_entries", ["project_id"], unique=False)
    if not inspector.has_table("project_budget_lines"):
        op.create_table(
            "project_budget_lines",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("label", sa.String(length=200), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("planned_amount", sa.Integer(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_project_budget_lines_id"), "project_budget_lines", ["id"], unique=False)
        op.create_index(op.f("ix_project_budget_lines_project_id"), "project_budget_lines", ["project_id"], unique=False)

    columns = {c["name"] for c in inspector.get_columns("donations")}
    if "reconciled_at" not in columns:
        op.add_column("donations", sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True))
    if "reconciled_by" not in columns:
        op.add_column("donations", sa.Column("reconciled_by", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("donations", "reconciled_by")
    op.drop_column("donations", "reconciled_at")
    op.drop_table("project_budget_lines")
    op.drop_table("finance_entries")
    op.drop_table("finance_documents")
