"""drop unused oidc_states table

Revision ID: c8d2e3f4a5b6
Revises: b7c1d2e3f4a5
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("oidc_states"):
        op.drop_table("oidc_states")


def downgrade() -> None:
    op.create_table(
        "oidc_states",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("state", sa.String(length=255), nullable=False),
        sa.Column("nonce", sa.String(length=255), nullable=False),
        sa.Column("code_verifier", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_oidc_states_id"), "oidc_states", ["id"], unique=False)
    op.create_index(op.f("ix_oidc_states_state"), "oidc_states", ["state"], unique=True)
