"""login codes: email second step for presidents and admins

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app creates missing tables at startup, so the table may already exist
    if sa.inspect(op.get_bind()).has_table("login_codes"):
        return
    op.create_table(
        "login_codes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("challenge_hash", sa.String(length=64), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_login_codes_id"), "login_codes", ["id"], unique=False)
    op.create_index(op.f("ix_login_codes_user_id"), "login_codes", ["user_id"], unique=False)
    op.create_index(op.f("ix_login_codes_challenge_hash"), "login_codes", ["challenge_hash"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_login_codes_challenge_hash"), table_name="login_codes")
    op.drop_index(op.f("ix_login_codes_user_id"), table_name="login_codes")
    op.drop_index(op.f("ix_login_codes_id"), table_name="login_codes")
    op.drop_table("login_codes")
