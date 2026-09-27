"""login attempts (brute-force throttling)

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app creates missing tables at startup, so the table may already exist
    if sa.inspect(op.get_bind()).has_table("login_attempts"):
        return
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_login_attempts_id"), "login_attempts", ["id"], unique=False)
    op.create_index(op.f("ix_login_attempts_email"), "login_attempts", ["email"], unique=False)
    op.create_index(op.f("ix_login_attempts_ip_address"), "login_attempts", ["ip_address"], unique=False)
    op.create_index(op.f("ix_login_attempts_created_at"), "login_attempts", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_login_attempts_created_at"), table_name="login_attempts")
    op.drop_index(op.f("ix_login_attempts_ip_address"), table_name="login_attempts")
    op.drop_index(op.f("ix_login_attempts_email"), table_name="login_attempts")
    op.drop_index(op.f("ix_login_attempts_id"), table_name="login_attempts")
    op.drop_table("login_attempts")
