"""users.is_technical_owner and audit_logs.seal (tamper-evident journal)

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "is_technical_owner" not in {c["name"] for c in inspector.get_columns("users")}:
        op.add_column("users", sa.Column("is_technical_owner", sa.Boolean(), server_default=sa.false(), nullable=False))
    if "seal" not in {c["name"] for c in inspector.get_columns("audit_logs")}:
        op.add_column("audit_logs", sa.Column("seal", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "seal")
    op.drop_column("users", "is_technical_owner")
