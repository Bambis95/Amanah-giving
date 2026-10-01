"""donations.anonymous (donor wall) and projects.end_date (countdown)

Revision ID: c6d7e8f9a0b1
Revises: a3b4c5d6e7f9
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, Sequence[str], None] = "a3b4c5d6e7f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "anonymous" not in {c["name"] for c in inspector.get_columns("donations")}:
        op.add_column("donations", sa.Column("anonymous", sa.Boolean(), nullable=True))
    if "end_date" not in {c["name"] for c in inspector.get_columns("projects")}:
        op.add_column("projects", sa.Column("end_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "end_date")
    op.drop_column("donations", "anonymous")
