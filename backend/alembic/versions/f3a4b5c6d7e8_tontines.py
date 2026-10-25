"""Tontines: groups, members, ledger operations and deposit slips

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USER_FK = dict(ondelete="SET NULL")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("tontine_groups"):
        op.create_table(
            "tontine_groups",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("kind", sa.String(length=10), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("frequency", sa.String(length=10), nullable=False),
            sa.Column("bank_name", sa.String(length=120), nullable=True),
            sa.Column("bank_account", sa.String(length=60), nullable=True),
            sa.Column("cash_alert_amount", sa.Integer(), nullable=False, server_default="50000"),
            sa.Column("cash_alert_days", sa.Integer(), nullable=False, server_default="7"),
            sa.Column("created_by", sa.String(length=255), sa.ForeignKey("users.id", **USER_FK), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_tontine_groups_id", "tontine_groups", ["id"])
    if not inspector.has_table("tontine_members"):
        op.create_table(
            "tontine_members",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("tontine_groups.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("phone", sa.String(length=30), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("user_id", sa.String(length=255), sa.ForeignKey("users.id", **USER_FK), nullable=True),
            sa.Column("role", sa.String(length=10), nullable=False),
            sa.Column("rotation_order", sa.Integer(), nullable=True),
            sa.Column("joined_at", sa.Date(), nullable=False),
            sa.Column("left_at", sa.Date(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        for column in ("id", "group_id", "email", "user_id"):
            op.create_index(f"ix_tontine_members_{column}", "tontine_members", [column])
    if not inspector.has_table("tontine_documents"):
        op.create_table(
            "tontine_documents",
            sa.Column("id", sa.String(length=32), nullable=False),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("tontine_groups.id", ondelete="CASCADE"), nullable=False),
            sa.Column("filename", sa.String(length=200), nullable=False),
            sa.Column("content_type", sa.String(length=50), nullable=False),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            sa.Column("size", sa.Integer(), nullable=False),
            sa.Column("uploaded_by", sa.String(length=255), sa.ForeignKey("users.id", **USER_FK), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_tontine_documents_group_id", "tontine_documents", ["group_id"])
    if not inspector.has_table("tontine_operations"):
        op.create_table(
            "tontine_operations",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("tontine_groups.id", ondelete="CASCADE"), nullable=False),
            sa.Column("kind", sa.String(length=12), nullable=False),
            sa.Column("member_id", sa.Integer(), sa.ForeignKey("tontine_members.id", ondelete="SET NULL"), nullable=True),
            sa.Column("op_date", sa.Date(), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("method", sa.String(length=20), nullable=False),
            sa.Column("source", sa.String(length=10), nullable=True),
            sa.Column("period", sa.String(length=10), nullable=True),
            sa.Column("reference", sa.String(length=100), nullable=True),
            sa.Column("document_id", sa.String(length=32), sa.ForeignKey("tontine_documents.id", ondelete="SET NULL"), nullable=True),
            sa.Column("recorded_by", sa.String(length=255), sa.ForeignKey("users.id", **USER_FK), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("validated_by", sa.String(length=255), sa.ForeignKey("users.id", **USER_FK), nullable=True),
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancelled_by", sa.String(length=255), sa.ForeignKey("users.id", **USER_FK), nullable=True),
            sa.Column("cancel_reason", sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        for column in ("id", "group_id", "member_id", "op_date"):
            op.create_index(f"ix_tontine_operations_{column}", "tontine_operations", [column])


def downgrade() -> None:
    op.drop_table("tontine_operations")
    op.drop_table("tontine_documents")
    op.drop_table("tontine_members")
    op.drop_table("tontine_groups")
