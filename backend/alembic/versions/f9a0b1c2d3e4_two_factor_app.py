"""Two-step sign-in with an authenticator app: users.totp_* and login_codes.method

Revision ID: f9a0b1c2d3e4
Revises: d7e8f9a0b1c2
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USER_COLUMNS = [
    ("totp_secret", sa.String(length=255)),
    ("totp_pending", sa.String(length=255)),
    ("totp_enabled_at", sa.DateTime(timezone=True)),
    ("totp_last_step", sa.Integer()),
    ("totp_recovery", sa.JSON()),
]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns("users")}
    for name, kind in USER_COLUMNS:
        if name not in existing:
            op.add_column("users", sa.Column(name, kind, nullable=True))
    if "method" not in {c["name"] for c in inspector.get_columns("login_codes")}:
        op.add_column("login_codes", sa.Column("method", sa.String(length=10), server_default="email", nullable=False))


def downgrade() -> None:
    op.drop_column("login_codes", "method")
    for name, _ in reversed(USER_COLUMNS):
        op.drop_column("users", name)
