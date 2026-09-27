"""add payment provider fields to donations

Revision ID: 6a6e060410b5
Revises: e3a251748956
Create Date: 2026-09-24 16:07:49.183772

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a6e060410b5'
down_revision: Union[str, Sequence[str], None] = 'e3a251748956'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add payment provider fields to donations."""
    op.add_column(
        "donations",
        sa.Column("payment_provider", sa.String(50), nullable=True),
    )
    op.add_column(
        "donations",
        sa.Column("payment_reference", sa.String(255), nullable=True),
    )
    op.add_column(
        "donations",
        sa.Column("payment_checkout_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "donations",
        sa.Column("paydunya_token", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    """Remove payment provider fields from donations."""
    op.drop_column("donations", "paydunya_token")
    op.drop_column("donations", "payment_checkout_url")
    op.drop_column("donations", "payment_reference")
    op.drop_column("donations", "payment_provider")
