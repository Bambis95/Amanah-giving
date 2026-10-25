"""Tontines: mbootaay solidarity aids (category and note on operations)

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("tontine_operations")}
    if "category" not in columns:
        op.add_column("tontine_operations", sa.Column("category", sa.String(length=20), nullable=True))
    if "note" not in columns:
        op.add_column("tontine_operations", sa.Column("note", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("tontine_operations", "note")
    op.drop_column("tontine_operations", "category")
