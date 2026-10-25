"""Tontines in self-service: premium period, verification badge, suspension

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, Sequence[str], None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    sa.Column("premium_until", sa.Date(), nullable=True),
    sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("verified_by", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("suspended_reason", sa.String(length=255), nullable=True),
]


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("tontine_groups")}
    for column in COLUMNS:
        if column.name not in existing:
            op.add_column("tontine_groups", column.copy())


def downgrade() -> None:
    for column in reversed(COLUMNS):
        op.drop_column("tontine_groups", column.name)
