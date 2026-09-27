"""allow anonymous donations

Revision ID: d9e4f5a6b7c8
Revises: c8d2e3f4a5b6
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c8d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("donations", "user_id", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Anonymous donations have no owner: tag them so the NOT NULL constraint can be restored
    op.execute("UPDATE donations SET user_id = 'anonymous' WHERE user_id IS NULL")
    op.alter_column("donations", "user_id", existing_type=sa.String(), nullable=False)
