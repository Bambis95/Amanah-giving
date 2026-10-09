"""Finance four eyes: entry validation, monthly closures and comments

Revision ID: a1c2e3f4b5d6
Revises: f9a0b1c2d3e4
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1c2e3f4b5d6"
down_revision: Union[str, Sequence[str], None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {c["name"] for c in inspector.get_columns("finance_entries")}
    if "validated_at" not in columns:
        op.add_column("finance_entries", sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True))
        # Entries recorded before this rule keep counting as they did
        op.execute("UPDATE finance_entries SET validated_at = created_at")
    if "validated_by" not in columns:
        op.add_column(
            "finance_entries",
            sa.Column("validated_by", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )
    if not inspector.has_table("finance_closures"):
        op.create_table(
            "finance_closures",
            sa.Column("month", sa.String(length=7), primary_key=True),
            sa.Column("closed_by", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    if not inspector.has_table("finance_comments"):
        op.create_table(
            "finance_comments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("entry_id", sa.Integer(), sa.ForeignKey("finance_entries.id", ondelete="CASCADE"), nullable=False),
            sa.Column("author_id", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("author_name", sa.String(length=255), nullable=True),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_finance_comments_id", "finance_comments", ["id"])
        op.create_index("ix_finance_comments_entry_id", "finance_comments", ["entry_id"])


def downgrade() -> None:
    op.drop_table("finance_comments")
    op.drop_table("finance_closures")
    op.drop_column("finance_entries", "validated_by")
    op.drop_column("finance_entries", "validated_at")
